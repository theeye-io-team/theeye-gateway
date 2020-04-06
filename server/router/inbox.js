const express = require('express')
const logger = require('../logger')('router:inbox')

module.exports = (app) => {
  const router = express.Router()

  /**
   *
   * fetch all inbox notifications
   *
   */
  router.get( (req, res, next) => {
    const user = req.user
    const session = req.session
    app.models
      .notification
      .find({
        customer_id: session.customer.id,
        user_id: req.user.id,
        limit: 40,
        sort: { createdAt: -1 }
      })
      .exec((err, records) => {
        if (err) { res.status(400).json(err) }
        else { res.json(records) }
      })
  })

  return router
}
