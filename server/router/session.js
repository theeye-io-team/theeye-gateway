const express = require('express')
const mongoose = require('mongoose')
const logger = require('../logger')('router:session')
const { REPLACE, DELETE } = require('../constants/operations')

module.exports = (app) => {
  const router = express.Router()

  /**
   *
   * get session profile
   *
   */
  router.get('/profile', async (req, res, next) => {
    try {
      const user = req.user
      const session = req.session

      const members = await app.models.member.find({ user_id: user._id })
      const customers = []
      if (members.length > 0) {
        for (let member of members) {
          await member.populate('customer', { id: 1, name: 1 }).execPopulate()
          customers.push(member.customer)
        }
      }

      await session.populate({
        path: 'member',
        populate: {
          path: 'customer'
        }
      }).execPopulate()

      let member = session.member

      let profile = {}
      profile.id = user._id.toString()
      profile.customers = customers // reduced information
      profile.last_login = user.last_login
      profile.name = user.name
      profile.username = user.username
      profile.email = user.email
      profile.onboardingCompleted = user.onboardingCompleted
      profile.current_customer = {
        id: member.customer.id,
        name: member.customer.name,
        config: member.customer.config
      }
      profile.notifications = member.notifications
      profile.credential = member.credential

      return res.json(profile)
    } catch (err) {
      logger.error(err)
      return res.status(err.status || 500).json(err)
    }
  })

  /**
   *
   * replace current session customer. need to generate a new session
   *
   */
  router.put(
    '/customer/:customer',
    async (req, res, next) => {
      try {
        const user = req.user
        const customer_id = req.params.customer

        const member = await app.models.member.findOne({
          user_id: user._id,
          customer_id: mongoose.Types.ObjectId(customer_id)
        })

        if (!member) {
          res.status(403)
          res.json({ message: 'Forbidden', statusCode: 401 })
          return
        }
        req.member = member
        next()
      } catch (err) {
        res.status(500)
        res.json({ message: 'Internal Server Error', statusCode: 500 })
      }
    },
    async (req, res, next) => {
      try {
        const member = req.member
        const session = req.session
        const newSession = await app.service.authentication.createSession(member)
        const model = { _id: session._id, user_id: session.user_id } // information to identify target user

        app.service.notifications.sockets.send({
          topic: 'session',
          data: {
            model,
            model_type: 'session',
            operation: REPLACE
          }
        })

        // destroy current session
        await req.session.remove()
        // return new session
        res.json({ access_token: newSession.token })
      } catch (err) {
        res.status(500)
        res.json({ message: 'Internal Server Error', statusCode: 500 })
      }
    }
  )

  const logout = async (req, res, next) => {
    const session = req.session
    app.service.notifications.sockets.send({
      topic: 'session',
      data: {
        model: { _id: session._id, user_id: session.user_id },
        model_type: 'session',
        operation: DELETE
      }
    })
    await session.remove()
    return res.status(200).json('OK')
  }

  router.post('/logout', logout)
  router.get('/logout', logout)

  router.put('/refresh', async (req, res, next) => {
    //const user = req.user
    const session = req.session
    await app.service.authentication.refreshSession(session)
    return res.status(200).json({ access_token: session.token })
  })

  router.get('/verify', (req, res, next) => {
    res.status(200).json(req.session)
  })

  /**
   *
   * update profile settings
   *
   */
  router.put(
    '/profile/settings',
    (req, res, next) => {
      const user = req.user
      const params = req.params.all()

      user.notifications = params.notifications
      user.save(err => {
        if (err) {
          sails.log.error(err)
          return res.send(500, 'internal server error')
        }

        res.send(200, { notifications: user.notifications })
      })
    }
  )

  router.put(
    '/profile/onboarding',
    (req, res, next) => {
      const user = req.user
      console.log(req.user, req.session)
      const params = req.params.all()

      user.onboardingCompleted = params.onboardingCompleted
      user.save(err => {
        if (err) {
          sails.log.error(err)
          return res.send(500, 'internal server error')
        }

        res.send(200, { onboardingCompleted: user.onboardingCompleted })
      })
    }
  )

  router.get(
    '/userpassport',
    (req, res, next) => {
      return res.status(200).json({})
    }
  )

  return router
}
