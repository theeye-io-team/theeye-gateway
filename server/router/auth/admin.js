const EscapedRegExp = require('../../escaped-regexp')
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
      if (!email || typeof email !== 'string' || !isEmail(email)) {
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
          origin: req.user._id.toString(), // a root user
          target: user._id.toString(),
          expiresIn: "10m"
        })

      user.security_token = token
      await user.save()

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
      if (!decoded.email) {
        throw new ClientError('Recovery Token is not valid')
      }
      const user = await app.models.users.uiUser.findOne({
        email: new EscapedRegExp(decoded.email,'i'),
        security_token: req.body.token
      })

      if (!user) {
        throw new ClientError('Recovery Token is not valid. User not found')
      }

      if (decoded.origin !== req.user._id.toString() || decoded.target !== user._id.toString()) {
        throw new ClientError('Recovery Token is not valid. Invalid operation')
      }

      const passport = await app.models.passport.findOne({ protocol: 'local', user_id: user.id })
      if (!passport) {
        throw new ClientError('Invalid Request. ERR_PASSPORT', { statusCode: 400 })
      }

      passport.password = await passport.hashPassword(req.body.password)
      await passport.save()

      user.security_token = null
      await user.save()

      res.json('ok')
    } catch (err) {
      next(err)
    }
  })

  return router
}
