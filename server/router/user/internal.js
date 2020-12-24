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
      const customer_id = req.session.customer_id

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

      const members = await app.models.member
        .find({
          customer_id,
          credential: {
            $nin: ['agent','integration']
          }
        })
        .populate({
          path: 'user',
          select: 'username email',
          match: {
            _type: 'UiUser',
            $or: [
              { email: { $in: emails } },
              { username: { $in: names } }
            ]
          }
        })

      let users = []
      for (let idx = 0; idx < members.length; idx++)  {
        let member = members[idx]
        if (member.user !== null) {
          users.push(member.user)
        }
      }

      res.json(users)
    } catch (err) {
      next (err)
    }
  })

  return router
}
