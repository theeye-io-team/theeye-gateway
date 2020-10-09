const express = require('express')
const logger = require('../../logger')('router:customer')
const crypto = require('crypto')
const CredentialsConstants = require('../../constants/credentials')
const isEmail = require('validator/lib/isEmail')
const dbFilterMiddleware = require('..//db-filter-middleware')

const { ClientError, ServerError } = require('../../errors')

module.exports = (app) => {
  const router = express.Router()

  router.get('/',
    dbFilterMiddleware({}),
    async (req, res, next) => {
      try {
        const dbFilters = req.filters
        const customers = await app.models.customer.apiFetch(dbFilters)
        res.json(customers)
      } catch (err) {
        next(err)
      }
    }
  )

  router.post('/', async (req, res, next) => {
    try {
      const data = req.body
      let customer
      let name = data.name.toLowerCase()

      if (!isValidCustomerName(name)) {
        throw new ClientError('Invalid customer name format')
      }

      customer = await app.models.customer.findOne({ name })
      if (customer !== null) {
        throw new ClientError(`customer already exists with name ${name}.`)
      }

      customer = await app.models.customer.create(data)
      await createCustomerAgent(app, customer)

      res.json(customer)
    } catch (err) {
      next(err)
    }
  })

  router.put('/:id', async (req, res, next) => {
    try {
      const id = req.params.id
      const update = req.body

      let customer = await app.models.customer.findById(id)
      if (!customer) {
        throw new ClientError('Customer Not Found')
      }

      customer.set(update)
      await customer.save()

      res.json(customer)
    } catch (err) {
      next(err)
    }
  })

  router.delete('/:id', async (req, res, next) => {
    try {
      const id = req.params.id

      let customer = await app.models.customer.findById(id)
      if (!customer) {
        throw new ClientError('Customer Not Found', { statusCode: 404 })
      }

      await app.models.member.deleteMany({ customer_id: customer._id })
      await customer.remove()
      res.json({})
    } catch (err) {
      next(err)
    }
  })

  return router
}

// @TODO move to IAM service
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

  let passport = await app.models.passport.create(passportData)

  let memberData = {
    user: agentUser._id,
    user_id: agentUser._id,
    customer: customer._id,
    customer_id:  customer._id,
    customer_name: customer.name,
    credential: CredentialsConstants.AGENT,
    enabled: true
  }

  let member = await app.models.member.create(memberData)

  return agentUser
}

const randomToken = () => crypto.randomBytes(20).toString('hex')

const isValidCustomerName = (name) => isEmail(`${name}@theeye.io`)
