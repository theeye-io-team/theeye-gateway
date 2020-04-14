const express = require('express')
const mongoose = require('mongoose')
const logger = require('../logger')('router:inbox')

module.exports = (app) => {
  const router = express.Router()

  /**
   *
   * fetch all inbox notifications
   *
   */
  router.get(
    '/',
    (req, res, next) => {
      const session = req.session
      app.models
        .notification
        .find({
          customer_id: session.customer_id,
          user_id: req.user.id
        })
        .limit(40)
        .sort({creation_date: -1})
        .exec((err, records) => {
          if (err) {
            logger.error(err)
            res.status(500)
            res.json({ message: "Internal Server Error", statusCode: 500 })
          } else {
            res.json(records)
          }
        })
    }
  )

  router.delete(
    '/',
    (req, res, next) => {
      const session = req.session

      const query = {
        customer_id: session.customer_id,
        user_id: req.user.id
      }

      if ( !(req.query.remove_all==='true') ) {
        query.read = true
      }

      app.models
        .notification
        .deleteMany(query)
        .exec((err, count) => {
          if (err) {
            logger.error(err)
            res.status(500)
            res.json({ message: "Internal Server Error", statusCode: 500 })
          } else {
            res.json({ count })
          }
        })
    }
  )

  router.get(
    '/unread/count',
    (req, res, next) => {
      const session = req.session
      app.models
        .notification
        .countDocuments({
          customer_id: session.customer_id,
          user_id: req.user.id,
          read: false
        })
        .exec((err, count) => {
          if (err) {
            logger.error(err)
            res.status(500)
            res.json({ message: "Internal Server Error", statusCode: 500 })
          } else {
            res.json(count)
          }
        })
    }
  )

  router.patch(
    '/markallread',
    (req, res, next) => {
      const session = req.session
      const notif = req.body

      let ids = notif.map(n => mongoose.Types.ObjectId(n.id)) // native mongodb query uses ObjectID

      app.models
        .notification
        .updateMany({
          _id: { $in: ids },
          customer_id: session.customer_id,
          user_id: req.user.id
        }, {
          read: true
        })
        .exec((err, result) => {
          if (err) {
            logger.error(err)
            res.status(500)
            res.json({ message: "Internal Server Error", statusCode: 500 })
          } else {
            res.status(200).json()
          }
        })
    }
  )

  return router
}
