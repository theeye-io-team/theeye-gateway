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
        const session = req.session
        const { organization } = req.body

        if (!organization.id) {
          throw new ClientError('Organization ID is required')
        }

        let customer = await app.models.customer.findOne({
          provider_uuid: `msazure:${organization.id}`
        })

        if (!customer) {
          const customer = await create(app, {
            owner: req.user.id,
            owner_id: req.user.id,
            display_name: organization.displayName,
            provider_uuid: organization.id,
            disabled: false
          })
        }

        req.customer = customer
        next()
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
        const { organization } = req.body

        if (!organization.id) {
          throw new ClientError('Organization ID is required')
        }

        let customer = await app.models.customer.findOne({
          provider_uuid: `msazure:${organization.id}`
        })

        if (!customer) {
          throw new ClientError(`Organization ${organization.id} not connected`)
        }

        req.customer = customer
        next()
      } catch (err) {
        logger.error('%o', err)
        next(err)
      }
    }, async (req, res, next) => {
      try {
        const customer = req.customer
        const { profile } = req.body
        logger.log('user profile')
        logger.log(profile)

        let passport
        let member
        let user = await app.models.users.uiUser.findOne({
          $or: [
            { email: new RegExp(profile.email, 'i') },
            { username: new RegExp(profile.username, 'i') }
          ]
        })

        // create the user
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

        // search user provider passport.
        passport = await app.models.passport.findOne({
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

        member = await app.models.member.findOne({
          user_id: user.id,
          customer_id: customer._id
        })

        if (!member) {
          member = await app.models.member.create({
            user: user._id,
            user_id: user.id,
            customer: customer._id,
            customer_id: customer._id,
            customer_name: customer.name,
            credential: (profile.credential || 'user')
          })
        }

        const session = await app.service.authentication.createSession({ member, protocol: passport.protocol })
        res.status(200).json({ access_token: session.token })
      } catch (err) {
        logger.error('%o', err)
        next(err)
      }
    }
  )

  return router
}
