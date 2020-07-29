const express = require('express')
const emailTemplates = require('../services/notifications/email/templates')

const logger = require('../logger')('router:auth')

module.exports = (app) => {
  const router = express.Router()

  router.post(
    '/login',
    (req, res, next) => {
      if (app.config.services.authentication.strategies.ldapauth) {
        app.service.authentication.middlewares.ldapPassport(req, res, next)
      } else {
        app.service.authentication.middlewares.basicPassport(req, res, next)
      }
    },
    async (req, res, next) => {
      try {
        let user = req.user
        let passport = req.passport
        let customerName = req.query.customer || null

        let session = await app.service.authentication.membersLogin({ user, passport, customerName })
        res.json({ access_token: session.token })
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
  router.post(
    '/password/recover',
    async (req, res, next) => {
      try {
        if (app.config.services.authentication.strategies.ldapauth) {
          return res.status(400).json({ error: 'ldapSet' })
        }
        let email = req.body.email
        if (!email) {
          return res.status(400).json({ message: "Missing param email." })
        }

        let user = await app.models.users.uiUser.findOne({ email: email })
        if(!user) return res.status(404).json({ message: "User not found" })

        if (user.enabled) {
          let token = app.service.authentication.issue({ email: user.email, expiresIn: "12h" })
          const queryToken = new Buffer( JSON.stringify({ token: token }) ).toString('base64')
          const passwordResetUrl = app.config.app.base_url + '/passwordreset?' + queryToken

          await sendPasswordRecoverEmail(app, {
            url: passwordResetUrl,
            email: user.email
          })
        } else {
          let token = app.service.authentication.issue({ email: user.email })
          user.set({invitation_token: token})
          await user.save()

          await sendUserActivationEMail(app, {
            name: user.name,
            email: user.email,
            activation_link: getActivationLink(user.invitation_token, app.config.activateUrl)
          })
        }

        res.json({})
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  router.get(
    '/password/recoververify',
    (req, res, next) => {
      try {
        if (!req.query.token) {
          return res.status(400).json({ message: "Missing param token." })
        }

        let decoded = app.service.authentication.verify(req.query.token)

        var resetToken = app.service.authentication.issue({email: decoded.email, expiresIn: "5m" })
        return res.json({ resetToken })
      } catch (err) {
        logger.error('%o', err)
        return res.send(400)
      }
    }
  )

  router.put(
    '/password/reset',
    async (req, res, next) => {
      try {
        if (!req.body.token) {
          return res.status(400).json({ message: "Missing param token." })
        }
        if (!req.body.password) {
          return res.status(400).json({ message: "Missing param password." })
        }
        if (!req.body.confirmation) {
          return res.status(400).json({ message: "Missing param confirmation." })
        }

        if (req.body.password != req.body.confirmation) {
          return res.status(400).json({ message: "Passwords dont match." })
        }

        let decoded = app.service.authentication.verify(req.body.token)
        let email = decoded.email

        let user = await app.models.users.uiUser.findOne({ email: email })
        if (!user) {
          return res.status(404).json({ message: "User not found." })
        }

        let passport = await app.models.passport.findOne({ protocol: 'local', user_id: user.id })
        if (!passport) {
          return res.status(404).json({ message: "User passport not found." })
        }
        passport.password = await passport.hashPassword(req.body.password)
        await passport.save()

        res.json({})
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  router.post(
    '/password/change',
    async (req, res, next) => {
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
        if (!req.body.id) {
          return res.status(400).json({ message: "Missing param user id." })
        }

        if (req.body.newPassword != req.body.confirmPassword) {
          return res.status(400).json({ message: "New passwords dont match." })
        }

        let user = await app.models.users.uiUser.findById(req.body.id)
        if (!user) {
          return res.status(404).json({ message: "User not found." })
        }

        let passport = await app.models.passport.findOne({ protocol: 'local', user_id: user.id })
        if (!passport) {
          return res.status(404).json({ message: "User passport not found." })
        }

        await passport.validatePassword(req.body.password)

        passport.password = await passport.hashPassword(req.body.newPassword)
        await passport.save()

        res.json({})
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  return router
}

const sendPasswordRecoverEmail = async (app, data) => {
  let html = emailTemplates.passwordRecover(data)

  var options = {
    to: data.email,
    subject: 'TheEye Password Recover',
    body: html
  }

  await app.service.notifications.email.send(options, data.email)
}

const sendUserActivationEMail = (app, data) => {
  let options = {
    subject: 'TheEye Account Activation',
    body: emailTemplates.activation(data)
  }

  return app.service.notifications.email.send(options, data.email)
}


const getActivationLink = (invitation_token, activate_url) => {
  let params = JSON.stringify({ invitation_token })
  let query = Buffer.from(params).toString('base64')
  return (activate_url + query)
}
