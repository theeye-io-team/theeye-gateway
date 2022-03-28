const Router = require('express').Router
const logger = require('../../logger')('router:auth')
const isEmail = require('validator/lib/isEmail')
const EscapedRegExp = require('../../escaped-regexp')

const { ClientError, ServerError } = require('../../errors')

module.exports = (app) => {
  const router = Router()

  router.post('/login', (req, res, next) => {
    if (app.config.services.authentication.strategies.ldapauth) {
      app.service.authentication.middlewares.ldapPassport(req, res, next)
    } else {
      app.service.authentication.middlewares.basicPassport(req, res, next)
    }
  }, async (req, res, next) => {
    try {
      let user = req.user
      let passport = req.passport
      let customerName = req.query.customer || null

      let session = await app.service.authentication.membersLogin({ user, passport, customerName })
      res.json({ access_token: session.token, credential: session.credential })
    } catch (err) {
      next(err)
    }
  })

  router.post('/login/local',
    app.service.authentication.middlewares.basicPassport,
    async (req, res, next) => {
      try {
        let user = req.user
        let passport = req.passport
        let customerName = req.query.customer || null

        let session = await app.service.authentication.membersLogin({ user, passport, customerName })
        res.json({ access_token: session.token, credential: session.credential })
      } catch (err) {
        next(err)
      }
    }
  )

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
        await app.service
          .notifications
          .email
          .sendPasswordRecoveryMessage({ user })
      } else {
        user.invitation_token = app.service.authentication.issue({ email: user.email })
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

  router.get('/password/recoververify', (req, res, next) => {
    try {
      if (!req.query.token) {
        throw new ClientError("Missing parameter token.")
      }

      const decoded = app.service.authentication.verify(req.query.token)
      if (decoded.origin !== 'recovery_email') {
        throw new ClientError('Recovery Token is no longer valid')
      }

      const resetToken = app.service.authentication.issue({ email: decoded.email, origin: "recovery_verify", expiresIn: "5m" })
      return res.json({ resetToken })
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
      if (!req.body.confirmation) {
        throw new ClientError("Missing parameter confirmation.")
      }
      if (req.body.password != req.body.confirmation) {
        throw new ClientError("Passwords does not match.")
      }

      let decoded = app.service.authentication.verify(req.body.token)
      if (decoded.origin !== 'recovery_verify') {
        throw new ClientError('Recovery Token is no longer valid')
      }

      const email = decoded.email

      if (!email) {
        throw new ClientError('Invalid Request. ERR_TOKEN')
      }

      const user = await app.models.users.uiUser.findOne({
        email: new EscapedRegExp(email,'i')
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
