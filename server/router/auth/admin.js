const express = require('express')
const isEmail = require('validator/lib/isEmail')
const logger = require('../../logger')('router:auth:admin')
const { ClientError, ServerError } = require('../../errors')

module.exports = (app) => {
  const router = express.Router()

  router.post('/password/recover', async (req, res, next) => {
    try {
      if (
        app.config.services.authentication.strategies.ldapauth &&
        ! app.config.services.authentication.localBypass
      ) {
        throw new ClientError('local password authentication is disabled. domain access enabled')
      }

      const email = req.body.email
      if (!isEmail(email)) {
        throw new ClientError('Email Required')
      }

      const user = await app.models.users.uiUser.findOne({
        email: new EscapedRegExp(email,'i')
      })

      if (!user) {
        throw new ClientError('User not found', { statusCode: 404 })
      }

      if (!user.enabled) {
        throw new ClientError('User is disabled', { statusCode: 400 })
      }

      const token = app.service
        .authentication
        .issue({
          email: user.email,
          origin: req.user._id, // a root user
          expiresIn: "10m"
        })

      res.json({ token })
    } catch (err) {
      next(err)
    }
  })

  router.put('/password/reset', async (req, res, next) => {
    try {
      if (!req.body.token) {
        throw new ClientError("Missing parameter token.")
      }

      if (!req.body.password) {
        throw new ClientError("Missing parameter password.")
      }

      const decoded = app.service.authentication.verify(req.body.token)
      if (decoded.origin !== req.user._id || !decoded.email) {
        throw new ClientError('Recovery Token is no longer valid')
      }

      const user = await app.models.users.uiUser.findOne({
        email: new EscapedRegExp(email,'i')
      })

      if (!user) {
        throw new ClientError('Invalid Request. ERR_USER', { statusCode: 400 })
      }

      const passport = await app.models.passport.findOne({ protocol: 'local', user_id: user.id })
      if (!passport) {
        throw new ClientError('Invalid Request. ERR_PASSPORT', { statusCode: 400 })
      }

      passport.password = await passport.hashPassword(req.body.password)
      await passport.save()

      res.json({})
    } catch (err) {
      next(err)
    }
  })
}
