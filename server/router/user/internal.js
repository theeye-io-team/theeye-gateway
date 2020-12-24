const express = require('express')
const isEmail = require('validator/lib/isEmail')
const logger = require('../../logger')('router:user')
const { ClientError, ServerError } = require('../../errors')
const dbFilterMiddleware = require('../db-filter-middleware')

module.exports = (app) => {
  const router = express.Router()

  router.get('/resolve/ids', dbFilterMiddleware({}), async (req, res, next) => {
    try {
      const filters = req.filters
      const values = filters.where.users

      if (!Array.isArray(values)) {
        throw new ClientError('Invalid data format. Array required')
      }

      if (values.length === 0) {
        throw new ClientError('Invalid approvers. Need at least one')
      }

      const emails = []
      const names = []

      for (let index = 0; index < values.length; index++) {
        let value = values[index]
        if (typeof value !== 'string') {
          throw new ClientError(`Invalid value ${value}. Must be string`)
        }

        const regex =  new RegExp(value,'i') 
        if (isEmail(value)) {
          emails.push(regex)
        } else {
          names.push(regex)
        }
      }

      const query = app.models.users.uiUser.find({
        $or: [
          { email: { $in: emails } },
          { username: { $in: names } }
        ]
      })

      let select
      if (filters.include) {
        select = filters.include
      } else {
        select = { username: 1, email: 1 }
      }

      query.select(select)

      const users = await query.exec()

      res.json(users)
    } catch (err) {
      next (err)
    }
  })

  return router
}
