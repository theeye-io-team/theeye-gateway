const express = require('express')
const got = require('got')
const { ClientError } = require('../errors')

module.exports = (app) => {
  const router = express.Router()

  /**
   * Get example
   * GET /boilerplate/:extension
   */
  router.get('/boilerplate/:extension', async (req, res, next) => {
    try {
      let extension = req.params.extension

      if (!extension || extension === "null") {
        throw new ClientError('Extension required')
      }

      const baseUrl = app.config.boilerplates.repo
      const url = `${baseUrl}/${extension}/source.${extension}`

      let response = await got(url, {})
      res.status(response.statusCode).send(response.body)
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
