const Router = require('express').Router
const ObjectId = require('mongoose').Types.ObjectId
const { ClientError, ServerError } = require('../../errors')
const logger = require('../../logger')('router:auth')

module.exports = (app) => {
  const router = Router()

  router.post('/signin', async (req, res, next) => {
    try {
      const reqsession = req.session

      if (!reqsession.customer_id) {
        throw new Error('invalid session')
      }

      const customer = await app.models.customer.findById(reqsession.customer_id)
      if (!customer) {
        throw new Error('invalid session customer id')
      }

      const profile = req.body

      let passport
      let user = await app.models.users.uiUser.findOne({ email: profile.email })
      if (!user) {
        user = new app.models.users.uiUser()
        user.username = profile.preferred_username.toLowerCase()
        user.email = profile.email.toLowerCase()
        user.name = profile.name
        user.enabled = true
        user.credential = null
        user.invitation_token = null
        user.devices = null
        user.notifications = null
        user.onboardingCompleted = true
        await user.save()

        passport = await app.models.passport.create({
          protocol: 'oauth2',
          provider: 'azuread-openidconnect',
          identifier: profile.sub,
          user: user._id,
          user_id: user._id,
          last_login: new Date()
        })

        await app.models.member.create({
          user: user._id,
          user_id: user.id,
          customer: customer._id,
          customer_id: customer._id,
          customer_name: customer.name,
          credential: 'user'
        })
      } else {
        passport = await app.models.passport.findOne({ user_id: user._id })
      }

      //const session = await app.service.authentication.createSession({ member, protocol: passport.protocol })
      const session = await app.service.authentication.membersLogin({ user, passport, customerName: customer.name })
      res.status(200).json({ access_token: session.token })
    } catch (err) {
      logger.error('%o', err)
      next(err)
    }
  })

  return router
}
