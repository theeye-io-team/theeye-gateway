const express = require('express')
const logger = require('../../logger')('router:customer')
const crypto = require('crypto')
const CredentialsConstants = require('../../constants/credentials')

module.exports = (app) => {
  const router = express.Router()

  router.get(
    '/',
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
    '/:id',
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
