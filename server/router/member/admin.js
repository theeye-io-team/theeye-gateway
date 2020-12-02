const express = require('express')
const logger = require('../../logger')('router:member:admin')
const CredentialsConstants = require('../../constants/credentials')
const isEmail = require('validator/lib/isEmail')
const common = require('./common')

const { ClientError, ServerError } = require('../../errors')

module.exports = (app) => {
  const router = express.Router()

  router.get(
    '/',
    async (req, res, next) => {
      try {
        let query = {}
        let ninCredentials = [CredentialsConstants.AGENT, CredentialsConstants.INTEGRATION]

        query.credential = { $nin: ninCredentials }
        req.db_query = query
        next()
      } catch (err) {
        next(err)
      }
    },
    common(app).fetch
  )

  router.delete( '/:id', async (req, res, next) => {
      try {
        const id = req.params.id
        const member = await app.models.member.findById(id)
        if (!member) {
          throw new ClientError('Member Not Found',{statusCode:404})
        }
        await member.remove()
        res.status(204).json({})
      } catch (err) {
        next(err)
      }
    }
  )

  router.patch( '/:id', async (req, res, next) => {
      try {
        if (!req.body.credential) {
          throw new ClientError('Missing credential')
        }

        const member = await app.models.member.findById(req.params.id)
        if (!member) {
          throw new ClientError('Member Not Found',{statusCode:404})
        }

        member.set({ credential: req.body.credential })
        await member.save()
        res.json(member)
      } catch (err) {
        next(err)
      }
    }
  )

  router.post( '/', async (req, res, next) => {
      try {
        const body = req.body

        if (!body.user.name) {
          let err = Error('Missing param name.')
          err.status = 400
          throw err
        }
        if (!body.user.email) {
          let err = Error('Missing param email.')
          err.status = 400
          throw err
        }
        if (!body.credential) {
          let err = Error('Missing param credential.')
          err.status = 400
          throw err
        }

        if (!isEmail(body.user.email)) {
          let err = Error('Invalid Email.')
          err.status = 400
          throw err
        }
        if (!body.customer_id) {
          let err = Error('Missing param customer.')
          err.status = 400
          throw err
        }

        req.context = {
          customer_id: body.customer_id,
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
