const Router = require('express').Router
const ObjectId = require('mongoose').Types.ObjectId
const { ClientError, ServerError } = require('../../errors')
const logger = require('../../logger')('router:auth:msazure')
const axios = require('axios')

const OIDCStrategy = require('passport-azure-ad').OIDCStrategy
const Passport = require('passport')

const { create } = require('../customer/common')

const AZUREAD_PROVIDER = 'azuread-openidconnect'

module.exports = (app) => {
  const config = app.config.services.authentication.strategies.oidcAzureAd
  const router = Router()

  if (!config || config.enabled === false || !config.options) {
    router.get('/signin', (req, res) => res.send(503,"MS Authentication service is disabled"))
    router.get('/connect', (req, res) => res.send(503,"MS Authentication service is disabled"))
    return router
    // break
  }

  const oidcStrategy = new OIDCStrategy(
    config.options,
    (req, ss, sub, payload, accessToken, refreshToken, done) => {
      try {
        if (config.dumpResponse === true) {
          logger.log('azure payload dump')
          logger.log(`ss ${ss}`)
          logger.log(`sub ${sub}`)
          logger.log(`accessToken ${accessToken}`)
          logger.log(`refreshToken ${refreshToken}`)
          logger.log(`payload %j`, payload)
        }

        if (!accessToken) {
          throw new Error('Could not obtain an Access Token')
        } else {
          logger.log('user authenticated.')
          done(null, { accessToken, refreshToken, payload })
        }
      } catch (err) {
        logger.error(err)
        done(err)
      }
    }
  )

  Passport.use(oidcStrategy)

  router.get('/signin',
    (req, res, next) => {
      Passport.authenticate('azuread-openidconnect',
        {
          session: false,
          response: res,
          failureRedirect: config.failureRedirect
        }
      )(req, res, next)
    }
  )

  router.post('/signin',
    (req, res, next) => {
      Passport.authenticate('azuread-openidconnect',
        {
          session: false,
          response: res,
          failureRedirect: config.failureRedirect
        }
      )(req, res, next)
    }
  )

  router.get('/connect',
    (req, res, next) => {
      const session_state = req.query.session_state
      Passport.authenticate('azuread-openidconnect',
        {
          customState: `session_connect:${session_state}`,
          session: false,
          response: res,
          failureRedirect: config.failureRedirect
        }
      )(req, res, next)
    }
  )

  router.post('/callback',
    (req, res, next) => {
      Passport.authenticate('azuread-openidconnect',
        {
          session: false,
          response: res,
          failureRedirect: config.failureRedirect
        }
      )(req, res, next)
    },
    async (req, res) => {
      try {
        logger.log(req.user)
        logger.log(req.params.customer_name)

        const profile = await buildUserProfile(req.user)
        const organization = await buildOrganizationProfile(req.user)
        const state = req.body.state

        const { member, passport } = await connectAccount(req, profile, organization, state)

        const session = await app.service.authentication
          .createSession({ member, passport })

        const qs = JSON.stringify({ access_token: session.token })
        const query = Buffer.from(qs).toString('base64')
        res.redirect(`${app.config.app.base_url}/tokenlogin?${query}`)
      } catch (err) {
        logger.error(err)
        if (err.response) {
          logger.error(err.response.data)
        }
        res.redirect('/error')
      }
    }
  )

  /**
   * @return {Promise}
   */
  const connectAccount = async (req,profile, organization, state) => {
    if (/session_connect:/.test(state)) {
      // user organization connection
      const token = state.replace(/session_connect:/, '')
      const { user, session } = await app.service.authentication.verifySessionToken(req, token)
      return userOrganizationConnect(profile, organization, user)
    } else {
      // internal registration
      return userSignin(profile, organization)
    }
  }

  const userOrganizationConnect = async (profile, organization, user) => {
    const customer = await app.models.customer.findById(req.session.customer_id)
    if (!customer) {
      throw new ClientError('Invalid session', { statusCode: 401 })
    }
    customer.provider_uuid = `${AZUREAD_PROVIDER}:${organization.id}`
    await customer.save()
    const passport = await passportCreate(user, profile)
    const member = await memberCreate(user, customer)

    return { passport, member, customer }
  }

  const userSignin = async (profile, organization) => {
    const customer = await app.models.customer.findOne({
      provider_uuid: `${AZUREAD_PROVIDER}:${organization.id}`
    })

    if (!customer) {
      throw new ClientError(`There is not a Customer connected to the Tenant ${organization.id}`)
    }

    // the customer already exists.
    // here we are registering a user signin using ms azure
    // we have to check whether the user is created or not
    const user = await userCreate(profile)

    const passport = await passportCreate(user, profile)

    const member = await memberCreate(user, customer)

    return { member, passport, user, customer }
  }

  router.get('/signout', function(req, res){
    req.logOut()
    res.redirect('https://login.microsoftonline.com/common/oauth2/logout?post_logout_redirect_uri=http://localhost:' + app.config.app.port)
  })

  const userCreate = async (profile) => {
    let user = await app.models.users.uiUser.findOne({
      $or: [
        { email: new RegExp(profile.email, 'i') },
        { username: new RegExp(profile.username, 'i') }
      ]
    })

    if (!user) {
      user = new app.models.users.uiUser()
      user.username = profile.username.toLowerCase()
      user.email = profile.email.toLowerCase()
      user.name = profile.name
      user.enabled = true
      user.credential = null
      user.invitation_token = null
      user.devices = null
      user.notifications = null
      user.onboardingCompleted = true
      await user.save()
      return user
    } else {
      try {
        // verify is the same username && email
        if (profile.username.toLowerCase() !== user.username.toLowerCase()) {
          throw new ClientError('User profile conflict. Username/Email does not match', { statusCode: 403 })
        } else if (profile.email.toLowerCase() !== user.email.toLowerCase()) {
          // same username, different email.
          // we should check if the emails are associated to the same user.
          if ( !user.extra_emails.includes(profile.email.toLowerCase()) ) {
            throw new ClientError('User profile conflict. Email is already assigned', { statusCode: 403 })
          }
        }
      } catch (err) {
        await app.service.notifications.email.send({
          subject: 'Enterprise Login Error',
          html: `
          <p>
          <div>Error: ${err.message}</div>
          <div>User trying to login.</div>
          <ul>
          <li>Email: ${profile.email}</li>
          <li>Username: ${profile.username}</li>
          </ul>
          <div>Existent user already registered.</div>
          <ul>
          <li>Email: ${user.email}</li>
          <li>Username: ${user.username}</li>
          </ul>
          </p>
          `,
          organization: 'Internal',
          address: app.config.services.notifications.email.support
        })

        throw err
      }
    }

    return user
  }

  const passportCreate = async (user, profile) => {
    // search user provider passport.
    let passport = await app.models.passport.findOne({
      user_id: user._id,
      provider: AZUREAD_PROVIDER
    })

    if (!passport) {
      passport = await app.models.passport.create({
        protocol: 'oauth2',
        provider: AZUREAD_PROVIDER,
        identifier: profile.id,
        user: user._id,
        user_id: user._id,
        last_login: new Date()
      })
    }
    return passport
  }

  const memberCreate = async (user, customer) => {
    let member = await app.models.member.findOne({
      user_id: user._id,
      customer_id: customer._id
    })

    if (!member) {
      member = await app.models.member.create({
        user: user._id,
        user_id: user.id,
        customer: customer._id,
        customer_id: customer._id,
        customer_name: customer.name,
        //credential: (profile?.credential || 'user')
        credential: 'user'
      })
    }
    return member
  }

  const buildUserProfile = async (user) => {
    const accessToken = user.accessToken

    logger.log('getting Azure user profile information')

    const payload = await axios.get(config.apis.profile, {
      headers: {
        Authorization: 'Bearer ' + accessToken
      }
    }).catch(err => {
      logger.error(err)
      return null
    })

    let data
    if (!payload) {
      data = Object.assign({}, user.payload, user.payload._json)
    } else {
      data = payload.data
    }

    logger.log(data)
    logger.log('building profile')

    const profile = azure2theeye(data, config.fields)
    if (!profile.credential) {
      profile.credential = (config.defaultCredential || 'user')
    }

    return profile
  }

  const buildOrganizationProfile = async (user) => {
    logger.log('getting user organization information')

    const payload = await axios.get(config.apis.organization ,{
      headers: {
        Authorization: 'Bearer ' + user.accessToken
      }
    }).catch(err => {
      logger.error(err)
      return null
    })

    let data
    if (payload === null) {
      data = { id: user.payload._json.tid }
    } else {
      data = payload.data?.value[0]
    }

    return data
  }

  const azure2theeye = (payload, attrsMap) => {
    const profile = {}

    for (let theeyeName in attrsMap) {
      const azureName = attrsMap[theeyeName]
      if (azureName !== null) {
        if (Array.isArray(azureName)) {
          for (let index = 0; index < azureName.length; index++) {
            const field = azureName[index]
            if (payload[field]) {
              profile[theeyeName] = payload[field]
            }
          }
        } else {
          profile[theeyeName] = payload[azureName]
        }

        // field value not found in azure ad returned payload
        if (!profile[theeyeName]) {
          throw new Error(`no suitable "${theeyeName}" found in azure profile`)
        }
      }
    }

    return profile
  }

  return router
}
