const Router = require('express').Router
const logger = require('../../logger')('router:auth')
const isEmail = require('validator/lib/isEmail')
const EscapedRegExp = require('../../escaped-regexp')

const { ClientError, ServerError } = require('../../errors')
const TOKEN_REASON_EMAIL = 'recovery_email'
const TOKEN_REASON_CONFIRMATION = 'recovery_verify'

module.exports = (app) => {
  const router = Router()

  router.post('/login', (req, res, next) => {
    if (app.config.services.authentication.strategies.ldapauth) {
      app.service.authentication.middlewares.ldapPassport(req, res, next)
    } else {
      app.service.authentication.middlewares.basicPassport(req, res, next)
    }
  }, createLoginSession)

  router.post('/login/local',
    app.service.authentication.middlewares.basicPassport,
    createLoginSession)

  const createLoginSession = async (req, res, next) => {
    try {
      const user = req.user
      const passport = req.passport
      const customerName = req.query.customer || null
      const callback = req.query.callback

      const session = await app.service.authentication.membersLogin({
        user,
        passport,
        customerName
      })

      res.cookie('auth', session.token, app.config.services.authentication.cookie)

      if (callback) {
        res.set('Location', `${callback}?access_token=${session.token}`)
        res.status(303)
        res.send()
      } else {
        res.json({ access_token: session.token })
      }
    } catch (err) {
      next(err)
    }
  }

  /**
   *
   * send reset password email
   *
   */
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
        return res.send('ok')
        //throw new ClientError('User not found', { statusCode: 404 })
      }

      // @TODO verify local passport exists and is valid
      if (user.enabled) {
        const token = user.security_token = app.service.authentication
          .issue({
            email: user.email,
            reason: TOKEN_REASON_EMAIL
          }, {
            expiresIn: "10m"
          })

        user.security_token = token
        await user.save()

        await app.service
          .notifications
          .email
          .sendPasswordRecoveryToken({ user, token })
      } else {
        user.invitation_token = app.service.authentication.issue({
          email: user.email
        })

        await app.service
          .notifications
          .email
          .sendActivationMessage({ user })
        await user.save()
      }

      res.json({})
    } catch (err) {
      next(err)
    }
  })

  router.get('/password/recoververify', async (req, res, next) => {
    try {
      const token = req.query.token
      if (!token) {
        throw new ClientError("Missing parameter token.")
      }

      const decoded = app.service.authentication.verify(token)
      if (decoded.reason !== TOKEN_REASON_EMAIL) {
        throw new ClientError('Recovery Token is not valid')
      }

      const user = await app.models.users.uiUser.findOne({
        email: new EscapedRegExp(decoded.email,'i'),
        security_token: token
      })

      if (!user) {
        throw new ClientError('Recovery Token is not valid')
      }

      const resetToken = app.service.authentication.issue({
        email: decoded.email,
        reason: TOKEN_REASON_CONFIRMATION
      }, {
        expiresIn: "1m"
      })

      user.security_token = resetToken
      await user.save()

      return res.json({ resetToken })
    } catch (err) {
      next(err)
    }
  })

  router.put('/password/reset', async (req, res, next) => {
    try {
      const token = req.body.token
      if (!token) {
        throw new ClientError("Missing parameter token.")
      }

      const decoded = app.service.authentication.verify(token)
      if (decoded.reason !== TOKEN_REASON_CONFIRMATION) {
        throw new ClientError('Recovery Token is not valid')
      }

      if (!req.body.password) {
        throw new ClientError("Missing parameter password.")
      }
      if (!req.body.confirmation) {
        throw new ClientError("Missing parameter confirmation.")
      }
      if (req.body.password != req.body.confirmation) {
        throw new ClientError("Passwords does not match.")
      }

      const user = await app.models.users.uiUser.findOne({
        email: new EscapedRegExp(decoded.email,'i'),
        security_token: token
      })

      if (!user) {
        throw new ClientError('Invalid Request. ERR_USER')
      }

      const passport = await app.models.passport.findOne({ protocol: 'local', user_id: user.id })
      if (!passport) {
        throw new ClientError('Invalid Request. ERR_PASSPORT')
      }
      passport.password = await passport.hashPassword(req.body.password)
      await passport.save()

      user.security_token = null
      user.save()

      res.json({})
    } catch (err) {
      next(err)
    }
  })

  const bearerMiddleware = app.service.authentication.middlewares.bearerPassport
  router.post('/password/change', bearerMiddleware, async (req, res, next) => {
    try {
      if (!req.body.password) {
        return res.status(400).json({ message: "Missing param password." })
      }
      if (!req.body.newPassword) {
        return res.status(400).json({ message: "Missing param new password." })
      }
      if (!req.body.confirmPassword) {
        return res.status(400).json({ message: "Missing param confirm password." })
      }
      //if (!req.body.id) {
      //  return res.status(400).json({ message: "Missing param id." })
      //}
      if (req.body.newPassword != req.body.confirmPassword) {
        return res.status(400).json({ message: "New passwords dont match." })
      }

      //let user = await app.models.users.uiUser.findById(req.body.id)
      //if (!user) {
      //  return res.status(404).json({ message: "User not found." })
      //}
      const user = req.user

      let passport = await app.models.passport.findOne({ protocol: 'local', user_id: user.id })
      if (!passport) {
        return res.status(404).json({ message: "User passport not found." })
      }

      await passport.validatePassword(req.body.password)

      passport.password = await passport.hashPassword(req.body.newPassword)
      await passport.save()

      res.json({})
    } catch (err) {
      next(err)
    }
  })

  return router
}
