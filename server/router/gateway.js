const express = require('express')
const passport = require('passport')
const logger = require('../logger')('router:gateway')

const fastProxy = require('fast-proxy')

module.exports = (app) => {
  const router = express.Router()

  const { proxy, close } = fastProxy({ base: app.config.supervisor.url })

  router.all(
    '/task',
    addCustomerToUrl(app),
    (req, res, next) => {
      proxy(req, res, req.url, {})
    }
  )

  router.all(
    '/task/:id/schedule',
    addCustomerToUrl(app),
    (req, res, next) => {
      proxy(req, res, req.url, {})
    }
  )

  router.all(
    '/job',
    addCustomerToUrl(app),
    (req, res, next) => {
      proxy(req, res, req.url, {})
    }
  )

  router.all(
    '/event',
    addCustomerToUrl(app),
    (req, res, next) => {
      proxy(req, res, req.url, {})
    }
  )

  router.all(
    '/host',
    addCustomerToUrl(app),
    (req, res, next) => {
      proxy(req, res, req.url, {})
    }
  )

  router.all(
    '/resource',
    addCustomerToUrl(app),
    (req, res, next) => {
      proxy(req, res, req.url, {})
    }
  )

  router.all(
    '/resource/:id',
    addCustomerToUrl(app),
    (req, res, next) => {
      proxy(req, res, req.url, {})
    }
  )

  router.all(
    '/tag',
    addCustomerToUrl(app),
    (req, res, next) => {
      proxy(req, res, req.url, {})
    }
  )

  router.all(
    '/file',
    addCustomerToUrl(app),
    (req, res, next) => {
      proxy(req, res, req.url, {})
    }
  )

  // route to supervisor
  router.all('*', (req, res, next) => {
    proxy(req, res, req.url, {})
  })

  return router
}

const addCustomerToUrl = (app) => {
  return async (req, res, next) => {
    const session = req.session
    let customer = await app.models.customer.findById(session.customer_id)
    if (customer) {
      req.url = '/' + customer.name + req.url
    } else {
      res.status(400).json({message:'Error building compatibility route, Customer not found.'})
    }
    return next()
  }
}
