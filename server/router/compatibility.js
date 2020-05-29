const express = require('express')
const logger = require('../logger')('router:auth')
const CredentialsConstants = require('../constants/credentials')
const mongoose = require('mongoose')

module.exports = (app) => {
  const router = express.Router()
  const bearerMiddleware = app.service.authentication.middlewares.bearerPassport

  router.post(
    '/auth/login',
    (req, res, next) => {
      if (req.body && req.body.identifier) {
        let credentials = Buffer.from(`${req.body.identifier}:${req.body.password}`).toString('base64')
        req.body.username = req.body.identifier
        req.headers.authorization = `Basic ${credentials}`
      }
      next()
    },
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
        let customer = req.query.customer || null
        let query = { user_id: user._id }
        if (customer) {
          query.customer_name = customer
        }

        let memberOf = await app.models.member.find(query)

        if (memberOf.length === 0) {
          return res
            .status(403)
            .json({
              message: 'Forbidden',
              reason: 'you are not a member',
              statusCode: 403
            })
        }

        let member = memberOf[0]
        const session = await app.service.authentication.createSession({ member, protocol: passport.protocol })
        res.json({ access_token: session.token })
      } catch (err) {
        logger.error(err)
        res.status(500).json({message:'internal server error'})
      }
    }
  )

  router.get(
    '/session/profile',
    bearerMiddleware,
    async (req, res, next) => {
      try {
        const user = req.user
        const session = req.session

        const members = await app.models.member.find({ user_id: user._id })
        const customers = []
        if (members.length > 0) {
          for (let member of members) {
            await member.populate('customer', { id: 1, name: 1 }).execPopulate()
            customers.push(member.customer)
          }
        }

        await session.populate({
          path: 'member',
          populate: {
            path: 'customer'
          }
        }).execPopulate()

        let member = session.member

        let profile = {}
        profile.id = user._id.toString()
        profile.customers = customers // reduced information
        profile.name = user.name
        profile.username = user.username
        profile.email = user.email
        profile.onboardingCompleted = user.onboardingCompleted
        profile.current_customer = {
          id: member.customer.id,
          name: member.customer.name,
          config: member.customer.config
        }
        profile.notifications = member.notifications
        profile.credential = session.credential
        profile.protocol = session.protocol

        profile.theeye = {
          profile: {
            customers: customers
          }
        }

        return res.json(profile)
      } catch (err) {
        errorResponse(err, res)
      }
    }
  )

  router.post('/session/refresh', async (req, res, next) => {
    //const user = req.user
    const session = req.session
    await app.service.authentication.refreshSession(session)
    return res.status(200).json({ access_token: session.token })
  })

  router.get(
    '/member/',
    bearerMiddleware,
    async (req, res, next) => {
      try {
        const session = req.session

        let query = {
          customer_id: mongoose.Types.ObjectId(session.customer_id)
        }

        let ninCredentials = [CredentialsConstants.AGENT, CredentialsConstants.INTEGRATION]
        if (session.credential !== CredentialsConstants.ROOT) {
          ninCredentials.push(CredentialsConstants.ROOT)
        }

        query.credential = { $nin: ninCredentials }

        let members = await app.models.member.find(query).exec()

        for (var member of members) {
          await member.populate({
            path: 'user',
            select: 'id name username email enabled'
          }).execPopulate()
        }

        res.json(members)
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  router.get(
    '/inbox/',
    bearerMiddleware,
    (req, res, next) => {
      const session = req.session
      app.models
        .notification
        .find({
          customer_id: session.customer_id,
          user_id: req.user.id
        })
        .limit(40)
        .sort({creation_date: -1})
        .exec((err, records) => {
          if (err) {
            logger.error(err)
            res.status(500)
            res.json({ message: "Internal Server Error", statusCode: 500 })
          } else {
            res.json(records)
          }
        })
    }
  )


  return router
}

const errorResponse = (err, res) => {
  logger.error(err)
  if (err.statusCode) {
    res.status(err.statusCode).json(err.message)
  } else {
    res.status(500).json('Internal Server Error')
  }
}
