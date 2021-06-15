const express = require('express')
const logger = require('../logger')('router:registration')
const isEmail = require('validator/lib/isEmail')
const got = require('got')
const crypto = require('crypto')
const CredentialsConstants = require('../constants/credentials')
const FormData = require('form-data')
const EscapedRegExp = require('../escaped-regexp')

const { ClientError, ServerError } = require('../errors')

module.exports = (app) => {
  const router = express.Router()

  router.get( '/verifyinvitationtoken', async (req, res, next) => {
    try {
      if (!req.query.invitation_token) {
        return res.status(400).json({message: 'invitation_token is required'})
      }

      const invitation_token = req.query.invitation_token
      let decoded = app.service.authentication.verify(invitation_token)
      let email = decoded.email

      if (!email) {
        let err = new Error('Invalid invitation_token')
        err.status = 400
        throw err
      }

      let fields = 'username email invitation_token'

      let user = await app.models.users.uiUser.findOne({
        invitation_token: invitation_token,
        email: new EscapedRegExp(email, 'i'),
        enabled: false
      }, fields)

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
  })

  router.post('/activate', async (req, res, next) => {
    try {
      if (!req.body.invitation_token) return res.status(400).json({message: 'invitation_token is required'})
      if (!req.body.password) return res.status(400).json({message: 'password is required'})
      if (!req.body.email) return res.status(400).json({message: 'email is required'})
      if (!req.body.username) return res.status(400).json({message: 'username is required'})
      if (!validUsername(req.body.username)) return res.status(400).json({message: 'incorrect username format'})

      const invitation_token = req.body.invitation_token
      let decoded = app.service.authentication.verify(invitation_token)
      if (!decoded.email || (decoded.email !== req.body.email)) {
        throw new ClientError('Invalid invitation_token')
      }

      let body = req.body
      let user = await verifyUserActivationData(body)

      // activate user
      user.set({
        enabled: true,
        username: body.username.toLowerCase(),
        invitation_token: ''
      })
      await user.save()

      // create local passport
      const passportData = {
        protocol: 'local',
        provider: 'theeye',
        password: body.password,
        user: user._id,
        user_id: user._id
      }
      const passport = await app.models.passport.create(passportData)

      let session = await app.service.authentication.membersLogin({ user, passport })
      res.json({ access_token: session.token })
    } catch (err) {
      next(err)
    }
  })

  router.post('/register', async (req, res, next) => {
    try {
      const config = app.config.grecaptcha
      if (config.enabled !== false) {
        // verify grecaptcha
        if (!req.body.grecaptcha) {
          throw new ClientError('Invalid payload. Verification error')
        }

        const secret = config.v2_secret
        if (!secret) {
          throw new ServerError('Verification key config error')
        }
        const url = config.url
        if (!url) {
          throw new ServerError('Verification url config error')
        }

        const form = new FormData()
        form.append('secret', secret)
        form.append('response', req.body.grecaptcha)

        let response = await got.post(url, { body: form })
        let json = JSON.parse(response.body)

        if (json.success !== true) {
          throw new ClientError('Invalid payload. Verification error')
        }
      }

      next()
    } catch (err) {
      return next(err)
    }
  }, async (req, res, next) => {
    try {
      if (app.config.services.registration.enabled === false) {
        throw new ClientError('Registration is not allowed', {statusCode:403})
      }
      if (
        app.config.services.authentication.strategies.ldapauth && 
        app.config.services.authentication.localBypass !== true
      ) {
        throw new ClientError('Registration is not allowed', {statusCode:403})
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
          { email: new EscapedRegExp(req.body.email, 'i') },
          { username: new EscapedRegExp(req.body.username, 'i') }
        ]
      })

      if (user) {
        if (user.username.toLowerCase() === req.body.username.toLowerCase()) {
          throw new ClientError('Username in use', { code: 'usernameTaken'})
        }
        if (user.email.toLowerCase() === req.body.email.toLowerCase()) {
          throw new ClientError('Email in use', { code: 'emailTaken'})
        }
      }

      const lcEmail = req.body.email.toLowerCase()


      const invitation_token = app.service.authentication
        .issue({ email: lcEmail }, { expiresIn: (30 * 24 * 60 * 60) }) // 30 days

      const userData = {
        email: lcEmail,
        username: lcEmail,
        name: req.body.name,
        enabled: false,
        invitation_token
      }

      user = await app.models.users.uiUser.create(userData)
      if (!user) { throw new ServerError() }

      await app.service
        .notifications
        .email
        .sendRegistrationMessage({ user })

      return res.status(200).json({ message: 'success' })
    } catch (err) {
      next(err)
    }
  })

  router.get('/checkusername', async (req, res, next) => {
    try {
      const username = req.query.username
      const token = req.query.token

      if (!token) {
        throw new ClientError('Token required.')
      }
      if (!username) {
        throw new ClientError('Username required.')
      }

      const user = await app.models.users.uiUser.findOne({ invitation_token: token })
      if (!user) {
        throw new ClientError('Invalid token.', { statusCode: 404 })
      }

      const usedUsername = await app.models.users.uiUser.find({
        _id: { $ne: user._id },
        username: new EscapedRegExp(username, 'i')
      })

      if (Array.isArray(usedUsername) && usedUsername.length > 0) {
        throw new ClientError('Username already in use.', { statusCode: 409 })
      }

      res.json({})
    } catch (err) {
      next(err)
    }
  })

  router.post( '/finish', async (req, res, next) => {
    try {
      if (!req.body.invitation_token) return res.status(400).json({message: 'invitation_token is required'})
      if (!req.body.password) return res.status(400).json({message: 'password is required'})
      if (!req.body.email) return res.status(400).json({message: 'email is required'})
      if (!req.body.username) return res.status(400).json({message: 'username is required'})
      if (!req.body.customername) return res.status(400).json({message: 'customername is required'})
      if (!validUsername(req.body.username)) return res.status(400).json({message: 'incorrect username format'})
      if (!validCustomerName(req.body.customername)) return res.status(400).json({message: 'incorrect username format'})

      const invitation_token = req.body.invitation_token
      let decoded = app.service.authentication.verify(invitation_token)
      if (!decoded.email || (decoded.email !== req.body.email)) {
        let err = new Error('Invalid invitation_token')
        err.status = 400
        throw err
      }

      let body = req.body

      // check if username is taken
      const prevUser = await app.models.users.uiUser.findOne({
        username: new EscapedRegExp(body.username, 'i')
      })

      if (prevUser) { throw new ClientError('usernameTaken') }

      // activate user
      const user = await app.models.users.uiUser.findOne({
        invitation_token: body.invitation_token,
        email: new EscapedRegExp(body.email, 'i'),
        enabled: false
      })

      if (!user) {
        throw new ClientError('User Not Found', { statusCode: 404 })
      }

      user.set({
        enabled: true,
        username: body.username.toLowerCase(),
        invitation_token: ''
      })
      await user.save()

      // create customer
      const customer = await app.models.customer.create({
        name: body.customername.toLowerCase()
      })

      if (!customer) {
        throw new ServerError()
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
      next(err)
    }
  })

  const verifyUserActivationData = async ({ invitation_token, email, username }) => {

    // search user to activate
    const users = await app.models.users.uiUser.find({
      invitation_token,
      email: new EscapedRegExp(email, 'i'),
      enabled: false
    })

    if (!users || users.length === 0) {
      throw new ClientError('User not found', { statusCode: 404 })
    }

    if (users.length > 1) {
      throw new ServerError('Invalid activation data')
    }

    const user = users[0]

    // check if username is taken
    const prevUsers = await app.models.users.uiUser.find({
      username: new EscapedRegExp(username, 'i')
    })

    if (Array.isArray(prevUsers) && prevUsers.length > 0) {
      if (prevUsers.length > 1) {
        throw new ClientError('usernameTaken')
      }

      if (prevUsers.length === 1) {
        if (user._id.toString() !== prevUsers[0]._id.toString()) {
          throw new ClientError('usernameTaken')
        }
      }
    }

    return user
  }

  return router
}

const validUsername = (username) => {
  return (isEmail(username) || isEmail(username + '@theeye.io'))
}

const validCustomerName = (name) => {
   let re = /^[a-zA-Z0-9._]+$/
   return re.test(name)
}

const randomToken = () => {
  return crypto.randomBytes(20).toString('hex')
}

const createCustomerAgent = async (app, customer) => {
  let cliendId = randomToken()
  let clientSecret = randomToken()

  const userData = {
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
