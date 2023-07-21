const express = require('express')
const logger = require('../logger')('router:assets')
const { ClientError } = require('../errors')
const { URL } = require('url')

module.exports = (app) => {
  const router = express.Router()

  router.get('/logo', async (req, res, next) => {
    try {
      let customerLogoUrl, imageBuffer, imageFormat

      const origin = req.headers.host || req.headers.origin
      const originUrl = parseUrl(origin)

      if (originUrl) {
        const customer = await app.models.customer.findOne({
          http_origins: {
            $regex: originUrl,
            $options: "i"
          }
        })

        if(customer?.logo) customerLogoUrl = customer.logo
      }

      if(!customerLogoUrl) customerLogoUrl = defaultLogoUrl

      try {
        [imageBuffer, imageFormat] = await getLogo(customerLogoUrl)
      } catch(err) {
        [imageBuffer, imageFormat] = await getLogo(defaultLogoUrl)
      }
      
      res.set('Content-Type', `image/${imageFormat}`)
      res.status(200).send(imageBuffer)
      
    } catch (err) {
    }
  })

  return router
}

const parseUrl = (inputUrl) => {
  try {
    if(/localhost/i.test(inputUrl)) return 'localhost'

    const parsedUrl = new URL(inputUrl)
    const { protocol, hostname } = parsedUrl
    const url = `${protocol}//${hostname}`
   
    return url
  } catch (err) {
    logger.error('Error parsing URL:', err.message)
    return null
  }
}
