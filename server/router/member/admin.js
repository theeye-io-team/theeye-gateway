const express = require('express')
const logger = require('../../logger')('router:member:admin')
const CredentialsConstants = require('../../constants/credentials')
const isEmail = require('validator/lib/isEmail')
const common = require('./common')

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
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    },
    common(app).fetch
  )

  router.delete(
    '/:id',
    async (req, res, next) => {
      try {
        const id = req.params.id

        let member = await app.models.member.findById(id)

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
    async (req, res, next) => {
      try {
        if (!req.body.credential) {
          return res.status(400).json({ message: "Missing param credential." })
        }

        let member = await app.models.member.findById(req.params.id)

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
    async (req, res, next) => {
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
