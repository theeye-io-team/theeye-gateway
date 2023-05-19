const express = require('express')
const dbFilterMiddleware = require('./db-filter-middleware')
const { ClientError, ServerError } = require('../errors')

module.exports = (app) => {
  const router = express.Router()

  router.get('/', dbFilterMiddleware({}), async (req, res, next) => {
    try {
      const dbFilters = req.filters
      dbFilters.where.customer_id = req.session.customer_id

      const roles = await app.models.role.apiFetch(dbFilters)
      res.json(roles)
    } catch (err) {
      next(err)
    }
  })

  const entityMapperMiddleware = async (req, res, next) => {
    try {
      const id = (req.body.id || req.query.id || req.params.id)

      const role = await app.models.role.findOne({
        id,
        customer_id: req.session.customer_id
      })

      if (!role) {
        throw new ClientError('role not found')
      }

      req.context.role = role
      next()
    } catch (err) {
      next(err)
    }
  }

  router.get('/:id', entityMapperMiddleware, async (req, res, next) => {
    try {

      res.json(req.context.role)
    } catch (err) {
      next(err)
    }
  })

  router.post('/', async (req, res, next) => {
    try {
      const attrs = req.body

      if (!Array.isArray(attrs.actions) || attrs.actions.length === 0) {
        throw new ClientError('invalid actions provided')
      }

      const role = new app.models.role(attrs)
      role.customer = req.session.customer_id
      role.customer_id = req.session.customer_id
      role.creation_date = new Date()
      role.last_update = new Date()

      await role.save()

      res.json(role)
    } catch (err) {
      next(err)
    }
  })

  router.put('/:id',
    entityMapperMiddleware,
    async (req, res, next) => {
    try {
      const update = req.body
      const role = req.context.role
      role.set(update)
      await role.save()
      res.json(role)
    } catch (err) {
      next(err)
    }
  })

  router.delete('/:id',
    entityMapperMiddleware,
    async (req, res, next) => {
    try {
      const role = req.context.role
      await role.remove()
      res.json({})
    } catch (err) {
      next(err)
    }
  })

  return router
}
