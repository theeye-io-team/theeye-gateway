const express = require('express')
const app = require('../app')

module.exports = () => {
  const router = express.Router()

  router.post('/login', controller.login)

  router.post('/logout', controller.logout)

  return router
}

const controller = {
  login (req, res, next) {
  },
  logout (req, res, next) {
  }
}
