const express = require('express')
const logger = require('../../logger')('router:notifications:admin')
const { ClientError, ServerError } = require('../../errors')

module.exports = (app) => {
  const router = express.Router()

  router.post('/:type', async (req, res, next) => {
    try {
      const type = req.params.type
      const body = req.body

      if (!body) {
        throw new ClientError('payload required')
      }

      if (!body.email) {
        throw new ClientError('email payload required')
      }

      logger.log('sending email test notification to %s', req.body.email)
      const subject = req.body.subject || 'TheEye Test'
      const content = req.body.content || 'Message Content'
      if (!app.service.notifications[type]) {
        throw new ClientError(`type ${type} unsupported`)
      }

      const user = await app.models.users.user.findOne({ email: body.email })
      if (!user) {
        throw new ClientError('User not found')
      }

      if (type !== 'email') {
        throw new ClientError('Can only send email notifications')
      }

      const response = await app.service
        .notifications[type]
        .send({
          subject,
          body: content,
          address: user.email
        })

      res.status(200).json(response)

    } catch (err) {
      logger.error(err)
      next(err)
    }
  })

  return router
}
