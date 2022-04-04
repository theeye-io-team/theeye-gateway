const express = require('express')
const dbFilterMiddleware = require('../db-filter-middleware')
const { ClientError, ServerError } = require('../../errors')

module.exports = (app) => {
  const router = express.Router()

  router.get('/', dbFilterMiddleware({}), async (req, res, next) => {
    try {
      const dbFilters = req.filters
      const policies = await app.models.policy.apiFetch(dbFilters)
      res.json(policies)
    } catch (err) {
      next(err)
    }
  })

  router.get('/:id', async (req, res, next) => {
    try {
      const policy = await app.models.policy.findById(id)
      if (!policy) {
        throw new ClientError('policy not found')
      }
      res.json(policy)
    } catch (err) {
      next(err)
    }
  })

  router.post('/', async (req, res, next) => {
    try {
      const data = req.body
      const policy = await app.models.policy.create(data)
      res.json(policy)
    } catch (err) {
      next(err)
    }
  })

  router.put('/:id', async (req, res, next) => {
    try {
      const id = req.params.id
      const update = req.body

      const policy = await app.models.policy.findById(id)
      if (!policy) {
        throw new ClientError('policy not found')
      }

      policy.set(update)
      await policy.save()

      res.json(policy)
    } catch (err) {
      next(err)
    }
  })

  router.delete('/:id', async (req, res, next) => {
    try {
      const id = req.params.id
      const policy = await app.models.policy.findById(id)
      if (!policy) {
        throw new ClientError('policy not found')
      }
      await policy.remove()
      res.json({})
    } catch (err) {
      next(err)
    }
  })

  return router
}
