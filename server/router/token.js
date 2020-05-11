const express = require('express')
const mongoose = require('mongoose')
const logger = require('../logger')('router:token')
const crypto = require('crypto')
const CredentialsConstants = require('../constants/credentials')

module.exports = (app) => {
  const router = express.Router()

  router.get(
    '/',
    credentialControl([CredentialsConstants.ROOT, CredentialsConstants.OWNER, CredentialsConstants.ADMIN]),
    async (req, res, next) => {
      try {
        const session = req.session
        const customer_id = session.customer_id
        let integrationMembers = []

        let customer = await app.models.customer.findById(customer_id)
        if (!customer) {
          let err = new Error('Customer not found')
          err.status = 500
          throw err
        }

        const members = await app.models.member.find({ customer_id:customer_id, credential: CredentialsConstants.INTEGRATION })
        for (const member of members) {
          await member.populate({
            path: 'user',
            select: 'id username'
          }).execPopulate()

          const session = await app.models.session.findOne({ user_id:member.user._id, customer_id:customer_id })
          if (session) {
            integrationMembers.push({ id: member.id, username: member.user.username, token: session.token })
          }
        }

        res.json(integrationMembers)
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  router.post(
    '/',
    credentialControl([CredentialsConstants.ROOT, CredentialsConstants.OWNER, CredentialsConstants.ADMIN]),
    async (req, res, next) => {
      try {
        const token = req.body
        const session = req.session
        const customer_id = session.customer_id

        let customer = await app.models.customer.findById(customer_id)
        if (!customer) {
          let err = new Error('Customer not found')
          err.status = 500
          throw err
        }

        const integrationMember = await createIntegrationModels(app, customer, token)
        const integrationSession = await app.service.authentication.createSession(integrationMember)
        token.id = integrationMember.id
        token.token = integrationSession.token
        res.json(token)
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  router.delete(
    '/:id',
    credentialControl([CredentialsConstants.ROOT, CredentialsConstants.OWNER, CredentialsConstants.ADMIN]),
    async (req, res, next) => {
      try {
        const id = req.params.id
        const session = req.session
        let integrationMember = await app.models.member.findById(id)
        if (!integrationMember) {
          let err = new Error('Member Not Found')
          err.status = 404
          throw err
        }
        const user_id = integrationMember.user_id
        await integrationMember.remove()

        let integrationSession = await app.models.session.findOne({
          user_id: user_id,
          customer_id: session.customer_id
        })
        if (integrationSession) {
          await integrationSession.remove()
        }

        let integrationPassport = await app.models.passport.findOne({
           user_id: user_id
         })
        if (integrationPassport) {
          await integrationPassport.remove()
        }

        let integrationUser = await app.models.users.botUser.findById(user_id)
        if (integrationUser) {
          await integrationUser.remove()
        }

        res.json({})
      } catch (err) {
        console.log(err)
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  return router
}

const randomToken = () => {
  return crypto.randomBytes(20).toString('hex')
}

const createIntegrationModels = async (app, customer, token) => {
  let cliendId = randomToken()
  let clientSecret = randomToken()

  let userData = {
    username: token.username,
    email: customer.name + '-integration@theeye.io',
    name: token.username,
    enabled: true,
    invitation_token: null,
    devices: null,
    notifications: null ,
    onboardingCompleted: true ,
    credential: null
  }

  let integrationUser = await app.models.users.botUser.create(userData)

  let passportData = {
    protocol: 'local',
    provider: 'theeye',
    password: clientSecret,
    identifier: cliendId,
    tokens: {
      access_token: null,
      refresh_token: clientSecret
    },
    user: integrationUser._id,
    user_id: integrationUser._id
  }

  await app.models.passport.create(passportData)

  let memberData = {
    user: integrationUser._id,
    user_id: integrationUser._id,
    customer: customer._id,
    customer_id:  customer._id,
    customer_name: customer.name,
    credential: CredentialsConstants.INTEGRATION,
    enabled: true
  }

  let member = await app.models.member.create(memberData)

  return member
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
