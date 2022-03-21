const express = require('express')
const isEmail = require('validator/lib/isEmail')
const isMongoId = require('validator/lib/isMongoId')
const logger = require('../../logger')('router:member:internal')
const { ClientError, ServerError } = require('../../errors')
const dbFilterMiddleware = require('../db-filter-middleware')
const EscapedRegExp = require('../../escaped-regexp')

module.exports = (app) => {
  const router = express.Router()

  router.get('/resolve', dbFilterMiddleware({}), async (req, res, next) => {
    try {
      const filters = req.filters
      const users = filters.where.users
      const customer_id = req.session.customer_id

      if (!Array.isArray(users)) {
        throw new ClientError('Invalid data format. Array required')
      }

      if (users.length === 0) {
        throw new ClientError('Invalid approvers. Need at least one')
      }

      const emails = []
      const names = []
      const ids = []

      for (let index = 0; index < users.length; index++) {
        let user = users[index]
        if (typeof user !== 'string') {
          throw new ClientError(`Invalid user format ${user}. Must be string`)
        }

        if (!user) {
          throw new ClientError(`Empty string`)
        }

        const regex = new EscapedRegExp(user,'i') // case insensitive
        if (isEmail(user)) {
          emails.push(regex)
        } else if(isMongoId(user)) {
          ids.push(user)
        } else {
          names.push(regex)
        }
      }

      const members = await app.models.member
        .find({
          customer_id
        })
        .populate({
          path: 'user',
          select: 'username email',
          match: {
            $or: [
              { _id: { $in: ids } },
              { email: { $in: emails } },
              { username: { $in: names } }
            ]
          }
        })

      res.json( members.filter(member => member.user !== null) )
    } catch (err) {
      next (err)
    }
  })

  return router
}
