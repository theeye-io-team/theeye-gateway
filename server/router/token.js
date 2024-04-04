const express = require('express')
const mongoose = require('mongoose')
const logger = require('../logger')('router:token')
const crypto = require('crypto')
const CredentialsConstants = require('../constants/credentials')
const PassportConstants = require('../constants/passport')

const { ClientError, ServerError } = require('../errors')

module.exports = (app) => {
  const router = express.Router()

  const aclsMiddleware = () => {
    let creds = [
      CredentialsConstants.ROOT,
      CredentialsConstants.OWNER,
      CredentialsConstants.ADMIN
    ]
    return credentialControl(creds)
  }

  router.get('/', aclsMiddleware(), async (req, res, next) => {
    try {
      const customer_id = req.session.customer_id
      let integrationPrincipals = []

      const customer = await app.models.customer.findById(customer_id)
      if (!customer) {
        throw new ClientError('Forbidden', { code: 'OrganizationAccessError', statusCode: 403 })
      }

      const members = await app.models.member.find({
        customer_id,
        credential: CredentialsConstants.INTEGRATION
      })

      for (const member of members) {
        await member.populate({
          path: 'user',
          select: 'id username name'
        }).execPopulate()

        let session = await app.models.session.findOne({
          user_id: member.user._id,
          customer_id: customer_id
        })

        let verificationError
        try {
          app.service.authentication.verify(session.token)
        } catch (err) {
          verificationError = err.message
        }

        if (session) {
          integrationPrincipals.push({
            id: member.id,
            username: member.user.username,
            name: member.user.name,
            token: session.token,
            verificationError
          })
        }
      }

      res.json(integrationPrincipals)
    } catch (err) {
      next(err)
    }
  })

  router.post('/', aclsMiddleware(), async (req, res, next) => {
    try {
      const data = req.body
      const customer_id = req.session.customer_id

      let customer = await app.models.customer.findById(customer_id)
      if (!customer) {
        throw new ClientError('Forbidden', { code: 'OrganizationAccessError', statusCode: 403 })
      }

      const { member, user } = await createIntegrationToken(app, customer, data)
      const tokenSession = await app.service.authentication.createSession({
        member,
        passport: {
          protocol: PassportConstants.PROTOCOL_LOCAL,
          provider: PassportConstants.PROVIDER_THEEYE,
        },
        neverExpires: true // never expires
      })

      const token = {
        id: member.id,
        username: user.username,
        name: user.name,
        token: tokenSession.token
      }

      res.json(token)
    } catch (err) {
      next(err)
    }
  })

  router.delete('/:id', aclsMiddleware(), async (req, res, next) => {
    try {
      const id = req.params.id
      const session = req.session

      const member = await app.models.member.findById(id)
      if (!member) {
        throw new ClientError('Member Not Found', {statusCode: 404})
      }

      const user_id = member.user_id

      app.models.session
        .findOne({ user_id, customer_id: session.customer_id })
        .then(session => session && session.remove())

      app.models.passport
        .findOne({ user_id })
        .then(passport => passport && passport.remove())

      app.models.users.botUser
        .findById(user_id)
        .then(user => user && user.remove())

      member.remove()

      res.json({})
    } catch (err) {
      next(err)
    }
  })

  return router
}

const randomToken = () => {
  return crypto.randomBytes(20).toString('hex')
}

const createIntegrationToken = async (app, customer, data) => {
  const clientId = randomToken()
  const clientSecret = randomToken()

  const username = (`${customer.name}-${clientId}-integration`).toLowerCase()
  const email = `${username}@theeye.io`

  const user = await app.models.users.botUser.create({
    username,
    email,
    name: data.name || username,
    enabled: true,
    onboardingCompleted: true ,
    invitation_token: null,
    devices: null,
    notifications: null ,
    credential: null
  })

  const passport = await app.models.passport.create({
    protocol: 'local',
    provider: 'theeye',
    password: clientSecret,
    identifier: clientId,
    tokens: {
      access_token: null,
      refresh_token: clientSecret
    },
    user: user._id,
    user_id: user._id
  })

  const member = await app.models.member.create({
    user: user._id,
    user_id: user._id,
    customer: customer._id,
    customer_id:  customer._id,
    customer_name: customer.name,
    credential: CredentialsConstants.INTEGRATION,
    enabled: true
  })

  return { member, passport, user }
}

const credentialControl = (requiredCredentials) => {
  return (req, res, next) => {
    const checkCredentials = (credential, accepted) => {
      return (accepted.indexOf(credential) !== -1)
    }

    let hasAccessLevel= checkCredentials(req.session.credential, requiredCredentials)
    if(!hasAccessLevel) {
        return res.status(403).json('Forbidden')
    }
    return next()
  }
}
