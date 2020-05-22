const express = require('express')
const logger = require('../logger')('router:message')
const TopicConstants = require('../constants/topics')

module.exports = (app) => {
  const router = express.Router()

  /**
   *
   * create new message
   *
   */
  router.post('/', (req, res, next) => {
    const session = req.session
    const body = req.body

    app.service.notifications.sockets.send({
      //id: ,
      topic: TopicConstants.MESSAGE_CRUD,
      data: {
        model: body,
        model_type: 'Message',
        operation: 'create',
        organization: session.customer_name,
        organization_id: session.customer_id
      }
    })

    res.status(200).send('Ok')
  })

  return router
}
