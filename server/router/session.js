const express = require('express')
const mongoose = require('mongoose')
const logger = require('../logger')('router:session')
const { REPLACE, DELETE } = require('../constants/operations')
const TopicConstants = require('../constants/topics')
const { ServerError, ClientError } = require('../errors')

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
      const customers = []

      const members = await app.models.member.find({ user_id: user._id })
      if (members.length === 0) {
        throw new ServerError('No Members', {code: 'UserNoMembers'})
      }

      for (let member of members) {
        await member.populate('customer', { id: 1, name: 1, display_name: 1 }).execPopulate()
        customers.push(member.customer)
      }

      await session.populate({
        path: 'member',
        populate: {
          path: 'customer'
        }
      }).execPopulate()

      let member = session.member
      if (!member) {
        throw new ServerError('Invalid Session', {code: 'SessionNoMember'})
      }
      if (!member.customer) {
        throw new ServerError('Invalid Session', {code: 'SessionNoCustomerMember'})
      }

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
        display_name: (member.customer.display_name || member.customer.name),
        config: member.customer.config
      }
      profile.notifications = member.notifications
      profile.credential = session.credential
      profile.protocol = session.protocol
      profile.member_id = member._id

      return res.json(profile)
    } catch (err) {
      next(err)
    }
  })

  /**
   * replace current session customer. need to generate a new session
   */
  router.put('/customer/:customer', async (req, res, next) => {
    try {
      const user = req.user
      const customer_id = req.params.customer

      const member = await app.models.member.findOne({
        user_id: user._id,
        customer_id: mongoose.Types.ObjectId(customer_id)
      })

      if (!member) {
        throw new ClientError('Forbidden', {code:'UserIsNoMember', statusCode: 403})
      }

      req.member = member
      next()
    } catch (err) {
      next(err)
    }
  }, async (req, res, next) => {
    try {
      const member = req.member
      const session = req.session
      const newSession = await app.service.authentication.createSession({ member, protocol: session.protocol })
      const model = { _id: session._id, user_id: session.user_id } // information to identify target user

      app.service.notifications.sockets.sendEvent({
        topic: TopicConstants.SESSION,
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
      next(err)
    }
  })

  const logout = async (req, res, next) => {
    try {
      const session = req.session
      app.service.notifications.sockets.sendEvent({
        topic: TopicConstants.SESSION,
        data: {
          model: { _id: session._id, user_id: session.user_id },
          model_type: 'session',
          operation: DELETE
        }
      })
      await session.remove()
      return res.status(200).json('OK')
    } catch (err) {
      next(err)
    }
  }

  router.post('/logout', logout)
  router.get('/logout', logout)

  router.put('/refresh', async (req, res, next) => {
    //const user = req.user
    try {
      const session = req.session
      await app.service.authentication.refreshSession(session)
      return res.status(200).json({ access_token: session.token })
    } catch (err) {
      next(err)
    }
  })

  router.get('/verify', (req, res, next) => {
    res.status(200).json(req.session)
  })

  /**
   *
   * update notifications preferences
   *
   */
  router.put('/profile/notifications', (req, res, next) => {
    try {
      //const params = req.params.all()
      if (!req.body) {
        throw new ClientError('Invalid Payload', { code: 'EmptyBody' })
      }

      const payload = req.body
      const upgradeable = [
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
        throw new ClientError('Invalid Payload', { code: 'EmptyNotificationsUpdate' })
      }

      req.notifications = updates
      next()
    } catch (err) {
      next(err)
    }
  }, async (req, res, next) => {
    try {
      const session = req.session
      await session.populate('member','notifications').execPopulate()
      const member = session.member

      //@TODO: create member 1 <> * notifications collection
      member.notifications = req.notifications
      await member.save()

      res.status(200).json({ notifications: member.notifications })
    } catch (err) {
      next(err)
    }
  })

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

  router.get('/passports', async (req, res, next) => {
    try {
      const user = req.user
      const passports = await app.models.passport
        .find(
          { user_id: user.id, provider: { $ne: 'theeye' } },
          {
            provider: 1,
            protocol: 1,
            last_login: 1,
            creation_date: 1
          }
        )

      res.status(200).json(passports)
    } catch (err) {
      next(err)
    }
  })

  router.put('/profile/avatar', async (req, res, next) => {
    try {
      //...
    } catch (err) {
      next(err)
    }
  })

  return router
}
