const express = require('express')
const logger = require('../logger')('router:assets')
const { ClientError } = require('../errors')
const urlStreamingMiddleware = require('./urlStreamingMiddleware')
const { URL } = require('url')


module.exports = (app) => {
  const router = express.Router()

  router.get('/logo',
    async (req, res, next) => {
      try {
        let customerLogoUrl, imageBuffer, imageFormat

        const origin = req.headers.referer || req.headers.origin

        if (!origin) {
          throw new ClientError('Forbidden', {statusCode:403})
        }

        const uri = new URL(origin)
        const { protocol, hostname } = uri

        const searchOrigin = `${protocol}//${hostname}`
        const customer = await app.models.customer.findOne({
          http_origins: new RegExp(searchOrigin, 'i')
        })

        if (!customer?.logo) {
          throw new ClientError('Logo Not Found', {statusCode: 204})
        }

        req.url = customer.logo
        return next()
      } catch (err) {
        next(err)
      }
    },
    urlStreamingMiddleware()
  )

  return router
}
