const express = require('express')
const logger = require('../../logger')('router:customer')
const CredentialsConstants = require('../../constants/credentials')
const credentialMiddleware = require ('../credentialMiddleware')

const { ClientError, ServerError } = require('../../errors')

module.exports = (app) => {
  const router = express.Router()

  router.put('/config', credentialMiddleware.check([
    CredentialsConstants.ROOT,
    CredentialsConstants.OWNER,
    CredentialsConstants.ADMIN
  ]), async (req, res, next) => {
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
  })

  router.put('/profile', credentialMiddleware.check([
    CredentialsConstants.ROOT,
    CredentialsConstants.OWNER
  ]), async (req, res, next) => {
    try {
      const session = req.session

      if (!session.customer_id) {
        throw new ClientError('Invalid Session', { statusCode: 403 })
      }

      const customer = await app.models.customer.findById(session.customer_id)
      if (!customer) {
        throw new ClientError('Customer Not Found', { statusCode: 403 })
      }

      const profile = req.body
      if (!profile) {
        throw new ClientError('Profile updates required')
      }

      customer.alias = profile.alias || null
      customer.description = profile.description || ''
      customer.display_name = profile.display_name || customer.name
      await customer.save()

      res.json(customer)
    } catch (err) {
      next(err)
    }
  })

  router.put('/profile/logo', credentialMiddleware.check([
    CredentialsConstants.ROOT,
    CredentialsConstants.OWNER
  ]), async (req, res, next) => {
    try {
      const session = req.session
      if (!session.customer_id) {
        throw new ClientError('Invalid Session', { statusCode: 403 })
      }
      const customer = await app.models.customer.findById(session.customer_id)
      if (!customer) {
        throw new ClientError('Customer Not Found', { statusCode: 403 })
      }
      //
      // get the logo image.
      // validate size.
      // store S3 as Image 
      // keep the key reference
      //
      await customer.save()

      res.json(customer)
    } catch (err) {
      next(err)
    }
  })

  return router
}
