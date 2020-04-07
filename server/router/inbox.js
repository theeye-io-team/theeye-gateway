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
          customer_id: mongoose.Types.ObjectId(session.customer_id),
          user_id: mongoose.Types.ObjectId(req.user.id)
        })
        .limit(40)
        .sort({creation_date: -1})
        .exec((err, records) => {
          if (err) { res.status(500).json({ message: "Error getting notifications" }) }
          else { res.json(records) }
        })
    }
  )

  router.delete(
    '/',
    (req, res, next) => {
      const session = req.session

      const query = {
        customer_id: mongoose.Types.ObjectId(session.customer_id),
        user_id: mongoose.Types.ObjectId(req.user.id)
      }

      if ( !(req.query.remove_all==='true') ) {
        query.read = true
      }

      app.models
        .notification
        .deleteMany(query)
        .exec((err, result) => {
          if (err) { res.status(500).json({ message: "Error deleting notifications" }) }
          else { res.json({count: result}) }
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
          customer_id: mongoose.Types.ObjectId(session.customer_id),
          user_id: mongoose.Types.ObjectId(req.user.id),
          read: false
        })
        .exec((err, count) => {
          if (err) { res.status(400).json({ message: "Error counting unread notifications" }) }
          else { res.json(count) }
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
          customer_id: mongoose.Types.ObjectId(session.customer_id),
          user_id: mongoose.Types.ObjectId(req.user.id)
        },
        {
          read: true
        })
        .exec((err, result) => {
          if (err) { res.status(500).json({ message: "Error updating notifications." }) }
          else { res.status(200).json() }
        })
    }
  )

  return router
}
