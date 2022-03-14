const express = require('express')
const isEmail = require('validator/lib/isEmail')
const got = require('got')
const crypto = require('crypto')
const FormData = require('form-data')
const logger = require('../../logger')('router:registration')
const CredentialsConstants = require('../../constants/credentials')
const EscapedRegExp = require('../../escaped-regexp')
const { ClientError, ServerError } = require('../../errors')

const { validUsername, usernameAvailable, isUserKeyAvailable } = require('../user/data-validate')
const { validateCustomerName } = require('../customer/data-validate')
const createCustomerAgentUser = require('../customer/create-agent')

module.exports = (app) => {
  const router = express.Router()

  router.get('/verifyinvitationtoken', async (req, res, next) => {
    try {
      if (!req.query.invitation_token) {
        throw new ClientError('Invitation_token is required')
      }

      const invitation_token = req.query.invitation_token
      const decoded = app.service.authentication.verify(invitation_token)
      const email = decoded.email

      if (!email) {
        throw new ClientError('Invalid invitation_token')
      }

      const user = await app.models.users.uiUser.findOne({
        invitation_token: invitation_token,
        email: new EscapedRegExp(email, 'i'),
        enabled: false
      }, 'username email invitation_token')

      if (!user) {
        throw new ClientError('User Not Found')
      }

      res.json(user)
    } catch (err) {
      next(err)
    }
  })

  router.post('/activate', async (req, res, next) => {
    try {
      const body = req.body

      if (!body.invitation_token) {
        throw new ClientError('Invitation token is required')
      }
      if (!isEmail(body.email)) {
        return res.status(400).json({message: 'email is required'})
      }
      if (!validUsername(body.username)) {
        throw new ClientError('Invalid Username. The username name can contains 6 to 20 letters (a-z), numbers (0-9), period (.), underscore (_) and hyphen (-)')
      }
      if (!body.password) {
        throw new ClientError('Password is required')
      }

      const user = await verifyUserActivationData(body)

      const passport = await activateUser(user, body)

      const session = await app.service.authentication.membersLogin({ user, passport })
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

        const response = await got.post(url, { body: form })
        const json = JSON.parse(response.body)

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
      const body = req.body
      if (app.config.services.registration.enabled === false) {
        throw new ClientError('Registration is not allowed', {statusCode:403})
      }
      if (
        app.config.services.authentication.strategies.ldapauth && 
        app.config.services.authentication.localBypass !== true
      ) {
        throw new ClientError('Registration is not allowed', {statusCode:403})
      }
      if (!body.name) {
        throw new ClientError('Missing param name.')
      }
      if (!isEmail(body.email)) {
        throw new ClientError('Invalid email.')
      }
      if (!body.username || body.email !== body.username) {
        if (!validUsername(body.username)) {
          throw new ClientError('Invalid Username. The username name can contains 6 to 20 letters (a-z), numbers (0-9), period (.), underscore (_) and hyphen (-)')
        }
      }

      await isUserKeyAvailable(app, body)

      await notifyUserRegistration(app, body)

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

      if (!validUsername(username)) {
        throw new ClientError('Invalid Username. The username name can contains 6 to 20 letters (a-z), numbers (0-9), period (.), underscore (_) and hyphen (-)')
      }

      const user = await app.models.users.uiUser.findOne({ invitation_token: token })
      if (!user) {
        throw new ClientError('Invalid token.', { statusCode: 404 })
      }

      await usernameAvailable(app, username, user)

      res.json({})
    } catch (err) {
      next(err)
    }
  })

  router.post('/finish', async (req, res, next) => {
    try {
      const body = req.body

      if (!body.invitation_token) {
        throw new ClientError('Invitation token is required')
      }
      if (!isEmail(body.email)) {
        return res.status(400).json({message: 'email is required'})
      }
      if (!validUsername(body.username)) {
        throw new ClientError('Invalid Username. The username name can contains 6 to 20 letters (a-z), numbers (0-9), period (.), underscore (_) and hyphen (-)')
      }
      if (!body.password) {
        throw new ClientError('Password is required')
      }

      validateCustomerName(app, body.customername)

      const user = await verifyUserActivationData(body)

      const passport = await activateUser(user, body)

      const customer = await activateCustomer(body.customername)

      customer.owner = user._id
      customer.owner_id = user._id
      await customer.save()

      // create member
      const member = await app.models.member.create({
        user: user._id,
        user_id: user.id,
        customer: customer._id,
        customer_id: customer._id,
        customer_name: customer.name,
        credential: CredentialsConstants.OWNER
      })

      member.user = user

      // create session
      const session = await app.service.authentication.createSession({ member, protocol: passport.protocol })
      res.json({ access_token: session.token })
    } catch (err) {
      next(err)
    }
  })

  const verifyUserActivationData = async ({ invitation_token, email, username }) => {
    const decoded = app.service.authentication.verify(invitation_token)
    if (!decoded.email || (decoded.email !== email)) {
      throw new ClientError('The provided information is invalid')
    }

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

    await usernameAvailable(app, username, user)

    return user
  }

  const activateUser = async (user, data) => {
    const { username, email, password, invitation_token } = data

    user.set({
      enabled: true,
      username: username.toLowerCase(),
      invitation_token: ''
    })
    await user.save()

    // create passport
    const passport = await app.models.passport.create({
      protocol: 'local',
      provider: 'theeye',
      password,
      user: user._id,
      user_id: user._id
    })

    return passport
  }

  const activateCustomer = async (name) => {
    // create customer
    const customer = await app.models.customer.create({
      name: name.toLowerCase()
    })

    // create agent customer
    await createCustomerAgentUser(app, customer)

    return customer
  }

  return router
}

//const validUsername = (username) => {
//  return (isEmail(username) || isEmail(username + '@theeye.io'))
//}

//const validCustomerName = (name) => {
//   let re = /^[a-zA-Z0-9._]+$/
//   return re.test(name)
//}

const notifyUserRegistration = async (app, { email, name }) => {
  const lcEmail = email.toLowerCase()

  const invitation_token = app.service.authentication
    .issue({ email: lcEmail }, { expiresIn: (30 * 24 * 60 * 60) }) // 30 days

  const user = await app.models.users.uiUser.create({
    email: lcEmail,
    username: lcEmail,
    name,
    enabled: false,
    invitation_token
  })

  if (!user) {
    throw new ServerError()
  }

  await app.service
    .notifications
    .email
    .sendRegistrationMessage({ user })

  return
}

//const createCustomerAgent = async (app, customer) => {
//  let cliendId = randomToken()
//  let clientSecret = randomToken()
//
//  const botEmail = customer.name + '-agent@theeye.io'
//  const botName = customer.name + '-agent'
//
//  const agentUser = await app.models.users.botUser.create({
//    username: cliendId,
//    email: botEmail.toLowerCase(),
//    name: botName.toLowerCase(),
//    enabled: true,
//    invitation_token: null,
//    devices: null,
//    notifications: null ,
//    onboardingCompleted: true ,
//    credential: null
//  })
//
//  await app.models.passport.create({
//    protocol: 'local',
//    provider: 'theeye',
//    password: clientSecret,
//    identifier: cliendId,
//    tokens: {
//      access_token: null,
//      refresh_token: clientSecret
//    },
//    user: agentUser._id,
//    user_id: agentUser._id
//  })
//
//  await app.models.member.create({
//    user: agentUser._id,
//    user_id: agentUser._id,
//    customer: customer._id,
//    customer_id:  customer._id,
//    customer_name: customer.name,
//    credential: CredentialsConstants.AGENT,
//    enabled: true
//  })
//
//  return
//}
//
//const randomToken = () => {
//  return crypto.randomBytes(20).toString('hex')
//}

