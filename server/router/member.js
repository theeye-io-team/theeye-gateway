const express = require('express')
const mongoose = require('mongoose')
const logger = require('../logger')('router:member')

module.exports = (app) => {
  const router = express.Router()

  router.get(
    '/',
    (req, res, next) => {
      const session = req.session

      let query = {
        customer_id: mongoose.Types.ObjectId(session.customer_id)
      }

      let ninCredentials = ['agent', 'integration']
      if (req.user.credential !== 'root') {
        ninCredentials.push('root')
      }

      query.credential = { $nin: ninCredentials }

      app.models
        .member
        .find(query)
        .populate({
          path: 'user',
          select: 'id name username email credential enabled invitation_token devices onboardingCompleted notifications'
        })
        .exec((err, members) => {
          if (err) { res.status(500).json({ message: "Error getting members." }) }
          else {
            res.json(members)
          }
        })
    }
  )

  router.delete(
    '/:id',
    (req, res, next) => {
      if (!req.params.id) {
        return res.status(400).json({ message: "Missing param id." })
      }

      const id = req.params.id

      app.models
        .member
        .findByIdAndRemove(id)
        .exec((err, result) => {
          if (err) { res.status(500).json({ message: "Error removing member." })}
          else { res.status(200).json() }
        })
    }
  )

  router.patch(
    '/:id',
    (req, res, next) => {
      if (!req.params.id) {
        return res.status(400).json({ message: "Missing param id." })
      }

      if (!req.body.credential) {
        return res.status(400).json({ message: "Missing param credential." })
      }

      const id = req.params.id
      const update = {
        credential: req.body.credential
      }

      app.models
        .member
        .findByIdAndUpdate(id,update)
        .exec((err, result) => {
          if (err) { res.status(500).json({ message: "Error updating member credential." })}
          else { res.status(200).json() }
        })

    }
  )

  return router
}
