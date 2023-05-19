const { ClientError, ServerError } = require('../../errors')
const logger = require('../../logger')('router:auth:admin')
const express = require('express')

const Roles = [
  'basic:viewer',
  'basic:user',
  'basic:agent',
  'basic:manager',
  'basic:admin',
  'basic:integration',
  'basic:owner',
  'basic:root'
]

module.exports = (app) => {
  const router = express.Router()

  router.post('/authorize', async (req, res, next) => {
    try {
      const { user, session } = req
      const { action, attrs } = req.body

      if (!action) {
        throw new ClientError('Action required')
      }

      const member = app.models
        .member
        .findById(session.member_id)

      res.json({})

    } catch (err) {
      next(err)
    }
  })

  return router
}
