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
      profile.credential = session.credential
      profile.protocol = session.protocol

      return res.json(profile)
    } catch (err) {
      errorResponse(err, res)
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
          let err = new Error('Forbidden')
          err.statusCode = 403
          throw err
        }

        req.member = member
        next()
      } catch (err) {
        if (err.statusCode) {
          res.status(err.statusCode)
          res.json({ message: 'Internal Server Error', statusCode: 500 })
        } else {
          res.status(500)
          res.json({ message: 'Internal Server Error', statusCode: 500 })
        }
      }
    },
    async (req, res, next) => {
      try {
        const member = req.member
        const session = req.session
        const newSession = await app.service.authentication.createSession({ member, protocol: session.protocol })
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
        errorResponse(err, res)
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
   * update notifications preferences
   *
   */
  router.put(
    '/profile/notifications',
    (req, res, next) => {
      try {
        //const params = req.params.all()
        if (!req.body) {
          let err = new Error('Invalid Payload')
          err.statusCode(400)
          throw err
        }

        let payload = req.body
        let upgradeable = [
          'notificationFilters',
          'email',
          'push',
          'desktop',
          'mute'
        ]

        // extra property
        let updates = {}
        for (let prop in payload) {
          if (upgradeable.indexOf(prop) !== -1) { // can update?
            //let err = new Error('Invalid Payload Property')
            //err.statusCode(400)
            //throw err
            updates[prop] = payload[prop]
          }
        }

        if (Object.keys(updates) === 0) {
          let err = new Error('Invalid Payload')
          err.statusCode(400)
          throw err
        }

        req.notifications = updates
        next()
      } catch (err) {
        errorResponse(err, res)
      }
    },
    async (req, res, next) => {
      try {
        const session = req.session
        await session.populate('member','notifications').execPopulate()
        const member = session.member

        //@TODO: create member 1 <> * notifications collection
        member.notifications = req.notifications
        await member.save()

        res.status(200).json({ notifications: member.notifications })
      } catch (err) {
        errorResponse(err, res)
      }
    }
  )

  router.put('/profile/onboarding/completed', async (req, res, next) => {
    try {
      const user = req.user
      user.onboardingCompleted = true
      await user.save()
      res.status(200).send({})
    } catch (err) {
      next(err)
    }
  })

  router.put('/profile/onboarding', async (req, res, next) => {
    try {
      const user = req.user
      user.onboardingCompleted = req.body.onboardingCompleted
      await user.save()
      res.status(200).send({})
    } catch (err) {
      next(err)
    }
  })

  router.get('/passports', (req, res, next) => {
    return res.status(200).json({})
  })

  return router
}

const errorResponse = (err, res) => {
  logger.error(err)
  if (err.statusCode) {
    res.status(err.statusCode).json(err.message)
  } else {
    res.status(500).json('Internal Server Error')
  }
}
