const express = require('express')
const dbFilterMiddleware = require('../db-filter-middleware')
const { ClientError, ServerError } = require('../../errors')

module.exports = (app) => {
  const router = express.Router()

  router.get('/', dbFilterMiddleware({}), async (req, res, next) => {
    try {
      const dbFilters = req.filters
      const policies = await app.models.group.apiFetch(dbFilters)
      res.json(policies)
    } catch (err) {
      next(err)
    }
  })

  router.get('/:id', async (req, res, next) => {
    try {
      const group = await app.models.group.findById(id)
      if (!group) {
        throw new ClientError('group not found')
      }
      res.json(group)
    } catch (err) {
      next(err)
    }
  })

  router.post('/', async (req, res, next) => {
    try {
      const data = req.body
      const group = await app.models.group.create(data)
      res.json(group)
    } catch (err) {
      next(err)
    }
  })

  router.put('/:id', async (req, res, next) => {
    try {
      const id = req.params.id
      const update = req.body

      const group = await app.models.group.findById(id)
      if (!group) {
        throw new ClientError('group not found')
      }

      group.set(update)
      await group.save()

      res.json(group)
    } catch (err) {
      next(err)
    }
  })

  router.delete('/:id', async (req, res, next) => {
    try {
      const id = req.params.id
      const group = await app.models.group.findById(id)
      if (!group) {
        throw new ClientError('group not found')
      }
      await group.remove()
      res.json({})
    } catch (err) {
      next(err)
    }
  })

  return router
}

