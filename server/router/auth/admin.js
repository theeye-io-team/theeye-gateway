const EscapedRegExp = require('../../escaped-regexp')
const express = require('express')
const isEmail = require('validator/lib/isEmail')
const logger = require('../../logger')('router:auth:admin')
const { ClientError, ServerError } = require('../../errors')

const TOKEN_REASON = 'password recovery'

module.exports = (app) => {
  const router = express.Router()

  router.put('/password/change', async (req, res, next) => {
    try {
      const { user_id, password } = req.body

      const user = await app.models.users.uiUser.findById(user_id)
      if (!user) {
        throw new ClientError('User not found', { statusCode: 404 })
      }

      const passport = await app.models.passport.findOne({ protocol: 'local', user_id: user.id })
      if (!passport) {
        throw new ClientError('Local login for the user is not enabled', { statusCode: 400 })
      }

      passport.password = await passport.hashPassword(password)
      await passport.save()

      await user.save() // increase last_update

      res.json('ok')
    } catch (err) {
      next(err)
    }
  })

  router.post('/password/recovery', async (req, res, next) => {
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
          reason: TOKEN_REASON
        }, {
          expiresIn: "10m"
        })

      user.security_token = token
      await user.save()

      res.json({ token })
    } catch (err) {
      next(err)
    }
  })

  router.post('/password/recovery/confirmation', async (req, res, next) => {
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
        throw new ClientError('Recovery Token is not valid')
      }

      if (decoded.reason !== TOKEN_REASON || decoded.target !== user._id.toString()) {
        throw new ClientError('Recovery Token is not valid')
      }

      if (decoded.origin !== req.user._id.toString()) {
        throw new ClientError('The session is not allowed to perform this action', { statusCode: 403 })
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
