const express = require('express')
const passport = require('passport')
const logger = require('../logger')('router:gateway')

const fastProxy = require('fast-proxy')

module.exports = (app) => {
  const router = express.Router()

  const { proxy, close } = fastProxy({ base: app.config.supervisor.url })

  // route to supervisor
  router.all('*', (req, res, next) => {
    proxy(req, res, req.url, {})
  })

  return router
}
