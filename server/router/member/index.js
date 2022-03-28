const express = require('express')
const logger = require('../../logger')('router:member:index')
const CredentialsConstants = require('../../constants/credentials')
const isEmail = require('validator/lib/isEmail')
const common = require('./common')
const credentialMiddleware = require ('../credentialMiddleware')
const ObjectId = require('mongoose').Types.ObjectId

module.exports = (app) => {
  const router = express.Router()

  router.get(
    '/',
    async (req, res, next) => {
      try {
        const session = req.session
        let query = {}
        let ninCredentials = [CredentialsConstants.AGENT, CredentialsConstants.INTEGRATION]
        if (session.credential !== CredentialsConstants.ROOT) {
          ninCredentials.push(CredentialsConstants.ROOT)
        }

        query.credential = { $nin: ninCredentials }
        query.customer_id = session.customer_id 
        req.db_query = query
        next()
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    },
    common(app).fetch
  )

  router.delete(
    '/:id',
    credentialMiddleware.check([CredentialsConstants.ROOT, CredentialsConstants.MANAGER, CredentialsConstants.OWNER]),
    async (req, res, next) => {
      try {
        const id = req.params.id
        const session = req.session

        let member = await app.models.member.findOne({
          _id: ObjectId(req.params.id),
          customer_id: req.session.customer_id 
        })

        if (!member) {
          let err = new Error('Member Not Found')
          err.status = 404
          throw err
        }

        await member.remove()
        res.status(204).json({})
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  router.patch(
    '/:id',
    credentialMiddleware.check([CredentialsConstants.ROOT, CredentialsConstants.MANAGER, CredentialsConstants.OWNER]),
    async (req, res, next) => {
      try {
        if (!req.body.credential) {
          return res.status(400).json({ message: "Missing param credential." })
        }

        let member = await app.models.member.findOne({
          _id: ObjectId(req.params.id),
          customer_id: req.session.customer_id 
        })

        if (!member) {
          let err = new Error('Member Not Found')
          err.status = 404
          throw err
        }

        member.set({ credential: req.body.credential })
        await member.save()
        res.json(member)
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  router.post(
    '/',
    credentialMiddleware.check([CredentialsConstants.ROOT, CredentialsConstants.MANAGER, CredentialsConstants.OWNER]),
    async (req, res, next) => {
      try {
        const body = req.body

        if (!body.user.name) {
          let err = Error('Missing param name.')
          err.status = 400
          throw err
        }
        if (!body.credential) {
          let err = Error('Missing param credential.')
          err.status = 400
          throw err
        }

        if (!body.user.email) {
          let err = Error('Missing param email.')
          err.status = 400
          throw err
        }
        if (!isEmail(body.user.email)) {
          let err = Error('Invalid Email.')
          err.status = 400
          throw err
        }

        req.context = {
          customer_id: req.session.customer_id,
          email: body.user.email,
          name: body.user.name,
          credential: body.credential
        }

        next()
      } catch (err) {
        next(err)
      }
    },
    common(app).create
  )

  return router
}
