const express = require('express')
const got = require('got')
const { ClientError } = require('../errors')

module.exports = (app) => {
  const router = express.Router()

  /**
   * Get example
   * GET /script/example/:extension
   */
  router.get('/script/example/:extension', async (req, res, next) => {
    try {
      let extension = req.params.extension

      if (!extension || extension === "null") {
        throw new ClientError('Extension required')
      }

      const scriptsPath = 'https://raw.githubusercontent.com/theeye-io/theeye-docs/master/scripts/examples/'
      const url = scriptsPath + 'example.' + extension

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
