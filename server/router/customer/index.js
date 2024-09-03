const express = require('express')
const logger = require('../../logger')('router:customer')
const CredentialsConstants = require('../../constants/credentials')
const credentialMiddleware = require ('../credentialMiddleware')
const urlStreamingMiddleware = require('../urlStreamingMiddleware')

const { ClientError } = require('../../errors')

module.exports = (app) => {
  const router = express.Router()

  router.put('/config',
    credentialMiddleware.check([
      CredentialsConstants.ROOT,
      CredentialsConstants.OWNER,
      CredentialsConstants.ADMIN
    ]),
    async (req, res, next) => {
      try {
        const session = req.session

        if (!session.customer_id) {
          throw new ClientError('Forbidden', { statusCode: 403 })
        }

        const customer = await app.models.customer.findById(session.customer_id)
        if (!customer) {
          throw new ClientError('Forbidden', { statusCode: 403 })
        }

        if (!req.body) {
          throw new ClientError('Invalid payload')
        }

        if (!req.body?.integration) {
          throw new ClientError('Missing param integration')
        }

        if (!req.body?.config) {
          throw new ClientError('Missing param config')
        }

        const { integration, config } = req.body

        customer.set({ ['config.' + integration]: config })
        await customer.save()

        res.json({ [ integration ]: config })
      } catch (err) {
        next(err)
      }
    }
  )

  router.delete('/config',
    credentialMiddleware.check([
      CredentialsConstants.ROOT,
      CredentialsConstants.OWNER,
      CredentialsConstants.ADMIN
    ]),
    async (req, res, next) => {
      try {
        const session = req.session
        // invalid session
        if (!session.customer_id) {
          throw new ClientError('Forbidden', { statusCode: 403 })
        }
        const customer = await app.models.customer.findById(session.customer_id)
        if (!customer) {
          throw new ClientError('Forbidden', { statusCode: 403 })
        }
        // bad payload
        if (!req.body.integration) {
          throw new ClientError('Integration required')
        }

        if (customer.config[req.body.integration]) {
          delete customer.config[req.body.integration]
          customer.markModified('config')
          await customer.save()
        }

        res.json(customer.config)
      } catch (err) {
        next(err)
      }
    }
  )

  router.get('/logo',
    async (req, res, next) => {
      try {
        const customer = await app.models.customer.findById(req.session.customer_id)
        if (!customer?.logo) {
          throw new ClientError('Logo not found', { statusCode: 204 })
        } else {
          req.url = customer.logo
          return next()
        }
      } catch (err) {
        next(err)
      }
    },
    urlStreamingMiddleware()
  )

  return router
}
