const express = require('express')
const logger = require('../../logger')('router:customer')
const CredentialsConstants = require('../../constants/credentials')
const credentialMiddleware = require ('../credentialMiddleware')

module.exports = (app) => {
  const router = express.Router()

  router.put('/config',
    credentialMiddleware.check([CredentialsConstants.ROOT, CredentialsConstants.OWNER, CredentialsConstants.ADMIN]),
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

  return router
}
