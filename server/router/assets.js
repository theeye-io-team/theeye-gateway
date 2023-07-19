const express = require('express')
const logger = require('../logger')('router:assets')
const got = require('got')
const { ClientError } = require('../errors')
const { URL } = require('url')

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

const getLogo = async (logoUrl) => {
  const response = await got(logoUrl, { responseType: 'buffer' })
  const imageBuffer = response.body
  const imageFormat = response.headers['content-type'].split('/')[1]
  return [imageBuffer, imageFormat]
}

module.exports = (app) => {
  const router = express.Router()

  router.get('/logo', async (req, res, next) => {
    try {

      // hay que resolver donde dejar el logo default
      let defaultLogoUrl = 'https://app.theeye.io/bundles/images/2652d15693ded77a9381199a926ac1aa.svg'
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
      // handle GOT errors
      if (err.name === 'HTTPError') {
        if (err.message.includes('Response code 404')) {
          next(new ClientError('Not Found'))
        }
      } else {
        next(err)
      }
    }
  })

  return router
}