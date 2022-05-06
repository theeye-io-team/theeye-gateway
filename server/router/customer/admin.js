const express = require('express')
const dbFilterMiddleware = require('../db-filter-middleware')
const { ClientError, ServerError } = require('../../errors')
const { create } = require('./common')

module.exports = (app) => {
  const router = express.Router()

  router.get('/', dbFilterMiddleware({}), async (req, res, next) => {
    try {
      const dbFilters = req.filters
      const customers = await app.models.customer.apiFetch(dbFilters)
      res.json(customers)
    } catch (err) {
      next(err)
    }
  })

  router.post('/', async (req, res, next) => {
    try {
      const data = req.body
      const customer = await create(app, data)
      res.json(customer)
    } catch (err) {
      next(err)
    }
  })

  router.put('/:id', async (req, res, next) => {
    try {
      const id = req.params.id
      const update = req.body

      let customer = await app.models.customer.findById(id)
      if (!customer) {
        throw new ClientError('Customer Not Found')
      }

      customer.set(update)
      await customer.save()

      res.json(customer)
    } catch (err) {
      next(err)
    }
  })

  router.delete('/:id', async (req, res, next) => {
    try {
      const id = req.params.id

      let customer = await app.models.customer.findById(id)
      if (!customer) {
        throw new ClientError('Customer Not Found', { statusCode: 404 })
      }

      await app.models.member.deleteMany({ customer_id: customer._id })
      await customer.remove()
      res.json({})
    } catch (err) {
      next(err)
    }
  })

  return router
}

