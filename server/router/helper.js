const express = require('express')
const got = require('got')

module.exports = (app) => {
  const router = express.Router()

  /**
   * Get example
   * GET /script/example/:extension
   */
  router.get('/script/example/:extension', async (req, res, next) => {
    try {
      const scriptsPath = 'https://raw.githubusercontent.com/theeye-io/theeye-docs/master/scripts/examples/'
      const url = scriptsPath + 'example.' + req.params.extension

      let response = await got(url, {})
      res.status(response.statusCode).send(response.body)
    } catch (err) {
      next(err)
    }
  })

  return router
}
