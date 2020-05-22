const express = require('express')
const mongoose = require('mongoose')
const logger = require('../logger')('router:customer')
const crypto = require('crypto')
const CredentialsConstants = require('../constants/credentials')

module.exports = (app) => {
  const router = express.Router()

  router.get(
    '/',
    credentialControl([CredentialsConstants.ROOT]),
    async (req, res, next) => {
      try {
        let customers = await app.models.customer.find({}).exec()
        res.json(customers)
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  router.post(
    '/',
    credentialControl([CredentialsConstants.ROOT]),
    async (req, res, next) => {
      try {
        const data = req.body

        if (!validateCustomerName(req.body.name)) return res.status(400).json({message: 'incorrect customer name format'})

        let customer = await app.models.customer.create(data)
        if (!customer) {
          let err = new Error('Error creating customer')
          err.status = 500
          throw err
        }

        await createCustomerAgent(app, customer)

        res.json(customer)
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  router.put(
    '/config',
    credentialControl([CredentialsConstants.ROOT, CredentialsConstants.OWNER, CredentialsConstants.ADMIN]),
    async (req, res, next) => {
      try {
        const session = req.session

        if (!session.customer_id) {
          return res.status(400).json({ message: "Missing param customer id." })
        }

        if (!req.body.integration) {
          return res.status(400).json({ message: "Missing param integration." })
        }

        if (!req.body.config) {
          return res.status(400).json({ message: "Missing param config." })
        }

        const id = session.customer_id
        const integration = req.body.integration
        const config = req.body.config

        let customer = await app.models.customer.findById(id)
        if (!customer) {
          let err = new Error('Customer Not Found')
          err.status = 404
          throw err
        }

        let key = 'config.' + integration
        customer.set({[key]: config})

        await customer.save()

        res.json({[integration]: config})
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  router.put(
    '/:id',
    credentialControl([CredentialsConstants.ROOT]),
    async (req, res, next) => {
      try {
        const id = req.params.id
        const update = req.body

        let customer = await app.models.customer.findById(id)
        if (!customer) {
          let err = new Error('Customer Not Found')
          err.status = 404
          throw err
        }

        customer.set(update)
        await customer.save()

        res.json(customer)
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  router.delete(
    '/:id',
    credentialControl([CredentialsConstants.ROOT]),
    async (req, res, next) => {
      try {
        const id = req.params.id

        let customer = await app.models.customer.findById(id)
        if (!customer) {
          let err = new Error('Customer Not Found')
          err.status = 404
          throw err
        }

        await app.models.member.deleteMany({customer_id: customer._id})

        await customer.remove()

        res.json({})
      } catch (err) {
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

const createCustomerAgent = async (app, customer) => {
  let cliendId = randomToken()
  let clientSecret = randomToken()

  let userData = {
    username: cliendId,
    //username: user.username || user.email,
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

const validateCustomerName = (name) => {
   let re = /^[a-zA-Z0-9._]+$/
   return re.test(name)
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
