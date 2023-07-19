const express = require('express')
const logger = require('../../logger')('router:customer')
const CredentialsConstants = require('../../constants/credentials')
const credentialMiddleware = require ('../credentialMiddleware')
const got = require('got')

const { ClientError } = require('../../errors')

const getLogo = async (logoUrl) => {
  const response = await got(logoUrl, { responseType: 'buffer' })
  const imageBuffer = response.body
  const imageFormat = response.headers['content-type'].split('/')[1]
  return [imageBuffer, imageFormat]
}

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

        const customer = await app.models.customer.findById(id)
        if (!customer) {
          let err = new Error('Customer Not Found')
          err.status = 404
          throw err
        }

        customer.set({ ['config.' + integration]: config })

        await customer.save()

        res.json({ [ integration ] : config })
      } catch (err) {
        next(err)
      }
    }
  )

  router.get('/logo',
    credentialMiddleware.check([
      CredentialsConstants.ROOT,
      CredentialsConstants.OWNER,
      CredentialsConstants.ADMIN,
      CredentialsConstants.MANAGER,
      CredentialsConstants.USER,
      CredentialsConstants.VIEWER,
      CredentialsConstants.AGENT,
      CredentialsConstants.INTEGRATION
    ]),
    async (req, res, next) => {
      try {

        // hay que resolver donde dejar el logo default
        let defaultLogoUrl = 'https://app.theeye.io/bundles/images/2652d15693ded77a9381199a926ac1aa.svg'
        let customerLogoUrl, imageBuffer, imageFormat
        
        const session = req.session
        
        if (session.customer_id) {
          const customer = await app.models.customer.findById(session.customer_id)
          if(customer?.logo) customerLogoUrl = customer.logo 
        } 
        
        if(!customerLogoUrl) customerLogoUrl = defaultLogoUrl
        console.log(customerLogoUrl)
        try {
          [imageBuffer, imageFormat] = await getLogo(customerLogoUrl)
        } catch(err) {
          [imageBuffer, imageFormat] = await getLogo(defaultLogoUrl)
        }
        
        res.set('Content-Type', `image/${imageFormat}`)
        res.status(200).send(imageBuffer)
      } catch (err) {
        console.log(err)
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
        // bad payload
        if (!req.body.integration) {
          throw new ClientError('Integration required')
        }
        //
        const customer = await app.models.customer.findById(session.customer_id)
        if (!customer) {
          throw new ClientError('Forbidden', { statusCode: 403 })
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

  return router
}
