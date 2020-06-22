const express = require('express')
const logger = require('../logger')('router:registration')
const isEmail = require('validator/lib/isEmail')
const got = require('got')
const emailTemplates = require('../services/notifications/email/templates')
const crypto = require('crypto')
const CredentialsConstants = require('../constants/credentials')
const FormData = require('form-data')

const { ClientError, ServerError } = require('../errors')

module.exports = (app) => {
  const router = express.Router()

  router.get(
    '/verifyinvitationtoken',
    async (req, res, next) => {
      try {
        if (!req.query.invitation_token) return res.status(400).json({message: 'invitation_token is required'})

        const invitation_token = req.query.invitation_token
        let decoded = app.service.authentication.verify(invitation_token)
        let email = decoded.email

        if (!email) {
          let err = new Error('Invalid invitation_token')
          err.status = 400
          throw err
        }

        let query = {
          invitation_token: invitation_token,
          email: email,
          enabled: false
        }
        let fields = 'username email invitation_token'

        let user = await app.models.users.uiUser.findOne(query, fields).exec()
        if (!user) {
          let err = new Error('User Not Found')
          err.status = 404
          throw err
        }

        res.json(user)
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  router.post(
    '/activate',
    async (req, res, next) => {
      try {
        if (!req.body.invitation_token) return res.status(400).json({message: 'invitation_token is required'})
        if (!req.body.password) return res.status(400).json({message: 'password is required'})
        if (!req.body.email) return res.status(400).json({message: 'email is required'})
        if (!req.body.username) return res.status(400).json({message: 'username is required'})
        if (!validateUsername(req.body.username)) return res.status(400).json({message: 'incorrect username format'})

        const invitation_token = req.body.invitation_token
        let decoded = app.service.authentication.verify(invitation_token)
        if (!decoded.email || (decoded.email !== req.body.email)) {
          let err = new Error('Invalid invitation_token')
          err.status = 400
          throw err
        }

        let body = req.body

        // check if username is taken
        let prevUser = await app.models.users.uiUser.findOne({username: body.username}).exec()
        if (prevUser) {
          let err = new Error('usernameTaken')
          err.status = 400
          throw err
        }

        // activate user
        let query = {
          invitation_token: body.invitation_token,
          email: body.email,
          enabled: false
        }

        let user = await app.models.users.uiUser.findOne(query).exec()
        if (!user) {
          let err = new Error('User Not Found')
          err.status = 404
          throw err
        }

        // authenticate user
        let member = await app.models.member.findOne({user_id: user._id})
        if (!member) {
          let err = new Error('Member Not Found')
          err.status = 404
          throw err
        }

        user.set({ enabled: true, username: body.username })
        await user.save()

        // create passport
        let passportData = {
          protocol: 'local',
          provider: 'theeye',
          password: body.password,
          user: user._id,
          user_id: user._id
        }

        let passport = await app.models.passport.create(passportData)

        const session = await app.service.authentication.createSession({ member, protocol: passport.protocol })
        res.json({ access_token: session.token })
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  router.post(
    '/register',
    async (req, res, next) => {
      try {
        // verify grecaptcha
        if (!req.body.grecaptcha) {
          throw new ClientError('Invalid payload. Verification error')
        }

        const config = app.config.grecaptcha
        const secret = config.v2_secret
        const url = config.url

        const form = new FormData()
        form.append('secret', secret)
        form.append('response', req.body.grecaptcha)

        let response = await got.post(url, { body: form })
        let json = JSON.parse(response.body)

        if (json.success !== true) {
          throw new ClientError('Invalid payload. Verification error')
        }

        next()
      } catch (err) {
        return next(err)
      }
    },
    async (req, res, next) => {
      try {
        if (app.config.services.registration.enabled === false) {
          throw new ClientError('Registration is disabled')
        }
        if (app.config.services.authentication.strategies.ldapauth) {
          throw new ClientError('Registration is disabled')
        }
        if (!req.body.name) {
          throw new ClientError('Missing param name.')
        }
        if (!req.body.username) {
          throw new ClientError('Missing param username.')
        }
        if (!req.body.email) {
          throw new ClientError('Missing param email.')
        }
        if (!isEmail(req.body.email)) {
          throw new ClientError('Invalid email.')
        }

        let user = await app.models.users.uiUser.findOne({
          $or: [
            { email: req.body.email },
            { username: req.body.username }
          ]
        })

        if (user) {
          if (user.username === req.body.username) {
            throw new ClientError('Username in use', { code: 'usernameTaken'})
          }
          if (user.email === req.body.email) {
            throw new ClientError('Email in use', { code: 'emailTaken'})
          }
        }

        let userData = {
          username: req.body.email,
          name: req.body.name,
          email: req.body.email,
          enabled: false,
          invitation_token: app.service.authentication.issue({ email: req.body.email })
        }

        user = await app.models.users.uiUser.create(userData)
        if (!user) {
          throw new ServerError()
        }

        await sendUserRegistrationEMail(app, {
          name: user.name,
          email: user.email,
          activation_link: getActivationLink(user.invitation_token, app.config.finishRegistrationUrl)
        })

        return res.status(200).json({ message: 'success' })
      } catch (err) {
        next(err)
      }
    }
  )

  router.get(
    '/checkusername',
    async (req, res, next) => {
      try {
        let username = req.query.username
        let token = req.query.token
        if (!username) {
          return res.status(400).json({ message: "Missing param username." })
        }
        if (!token) {
          return res.status(400).json({ message: "Missing param token." })
        }

        let user = await app.models.users.uiUser.findOne({invitation_token: token})
        if (!user) return res.status(404).json({ message: "User not found." })

        let prevUser = await app.models.users.uiUser.findOne({username: username})
        if (prevUser) return res.status(409).json({ message: "Username already in use." })

        res.json({})
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  router.post(
    '/finish',
    async (req, res, next) => {
      try {
        if (!req.body.invitation_token) return res.status(400).json({message: 'invitation_token is required'})
        if (!req.body.password) return res.status(400).json({message: 'password is required'})
        if (!req.body.email) return res.status(400).json({message: 'email is required'})
        if (!req.body.username) return res.status(400).json({message: 'username is required'})
        if (!req.body.customername) return res.status(400).json({message: 'customername is required'})
        if (!validateUsername(req.body.username)) return res.status(400).json({message: 'incorrect username format'})
        if (!validateCustomerName(req.body.customername)) return res.status(400).json({message: 'incorrect username format'})

        const invitation_token = req.body.invitation_token
        let decoded = app.service.authentication.verify(invitation_token)
        if (!decoded.email || (decoded.email !== req.body.email)) {
          let err = new Error('Invalid invitation_token')
          err.status = 400
          throw err
        }

        let body = req.body

        // check if username is taken
        let prevUser = await app.models.users.uiUser.findOne({username: body.username}).exec()
        if (prevUser) {
          let err = new Error('usernameTaken')
          err.status = 400
          throw err
        }

        // activate user
        let query = {
          invitation_token: body.invitation_token,
          email: body.email,
          enabled: false
        }

        let user = await app.models.users.uiUser.findOne(query)
        if (!user) {
          let err = new Error('User Not Found')
          err.status = 404
          throw err
        }

        user.set({ enabled: true, username: body.username })
        await user.save()

        // create customer
        let customer = await app.models.customer.create({name: body.customername})
        if (!customer) {
          let err = new Error('Error creating customer')
          err.status = 500
          throw err
        }

        // create agent customer
        await createCustomerAgent(app, customer)

        // create member
        let memberData = {
          user: user._id,
          user_id: user.id,
          customer: customer._id,
          customer_id: customer._id,
          customer_name: customer.name,
          credential: CredentialsConstants.OWNER
        }

        let member = await app.models.member.create(memberData)
        member.user = user

        // create passport
        let passportData = {
          protocol: 'local',
          provider: 'theeye',
          password: body.password,
          user: user._id,
          user_id: user._id
        }

        let passport = await app.models.passport.create(passportData)

        // create session
        const session = await app.service.authentication.createSession({ member, protocol: passport.protocol })
        res.json({ access_token: session.token })
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )
  return router
}

const validateUsername = (username) => {
  return (isEmail(username) || isEmail(username + '@theeye.io'))
}

const validateCustomerName = (name) => {
   let re = /^[a-zA-Z0-9._]+$/
   return re.test(name)
}

const getActivationLink = (invitation_token, activate_url) => {
  let params = JSON.stringify({ invitation_token })
  let query = Buffer.from(params).toString('base64')
  return (activate_url + query)
}

const sendUserRegistrationEMail = (app, data) => {
  let options = {
    subject: 'TheEye Registration',
    body: emailTemplates.registration(data)
  }

  return app.service.notifications.email.send(options, data.email)
}

const randomToken = () => {
  return crypto.randomBytes(20).toString('hex')
}

const createCustomerAgent = async (app, customer) => {
  let cliendId = randomToken()
  let clientSecret = randomToken()

  let userData = {
    username: cliendId,
    email: customer.name + '-agent@theeye.io',
    name: customer.name + '-agent',
    enabled: true,
    invitation_token: null,
    devices: null,
    notifications: null ,
    onboardingCompleted: true ,
    credential: null
  }

  let agentUser = await app.models.users.botUser.create(userData)

  let passportData = {
    protocol: 'local',
    provider: 'theeye',
    password: clientSecret,
    identifier: cliendId,
    tokens: {
      access_token: null,
      refresh_token: clientSecret
    },
    user: agentUser._id,
    user_id: agentUser._id
  }

  await app.models.passport.create(passportData)

  let memberData = {
    user: agentUser._id,
    user_id: agentUser._id,
    customer: customer._id,
    customer_id:  customer._id,
    customer_name: customer.name,
    credential: CredentialsConstants.AGENT,
    enabled: true
  }

  await app.models.member.create(memberData)

  return
}
