const Router = require('express').Router
const ObjectId = require('mongoose').Types.ObjectId
const { ClientError, ServerError } = require('../../errors')
const logger = require('../../logger')('router:auth')

const { create } = require('../customer/common')

const AZUREAD_PROVIDER = 'azuread-openidconnect'

module.exports = (app) => {
  const router = Router()

  router.post('/connect',
    app.service.authentication.middlewares.bearerPassport,
    async (req, res, next) => {
      try {
        const { profile, organization } = req.body
        const user = req.user

        if (!organization.id) {
          throw new ClientError('Tenant ID not present in payload')
        }

        const customer = await app.models.customer.findById(req.session.customer_id)
        if (!customer) {
          throw new ClientError('Invalid session', { statusCode: 401 })
        }
        customer.provider_uuid = `${AZUREAD_PROVIDER}:${organization.id}`
        await customer.save()

        const passport = await passportCreate(user, profile)

        res.status(200).json('ok')
      } catch (err) {
        logger.error('%o', err)
        next(err)
      }
    }
  )

  //
  // user authentication is made using another microservice
  //
  router.post('/signin',
    app.service.authentication.middlewares.gatewayPassport,
    async (req, res, next) => {
      try {
        const { profile, organization } = req.body

        if (!organization.id) {
          throw new ClientError('Organization ID is required')
        }

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

        const session = await app.service.authentication
          .createSession({ member, passport })

        res.status(200).json({ access_token: session.token })
      } catch (err) {
        logger.error('%o', err)
        next(err)
      }
    }
  )

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

  return router
}
