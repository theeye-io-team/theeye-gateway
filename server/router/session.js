const express = require('express')
const logger = require('../logger')('router:session')

module.exports = (app) => {
  const router = express.Router()

  /**
   *
   * get session profile
   *
   */
  router.get(
    '/profile',
    async (req, res, next) => {
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
    }
  )

  const logout = async (req, res, next) => {
    await req.session.remove()
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

  /**
   *
   * set current session customer
   *
   */
  router.post(
    '/customer/:customer',
    (req, res, next) => {
      const customer = req.params.customer
      const user = req.user

      if (user.customers.indexOf(customer) !== -1) {
        user.current_customer = customer
        user.save(err => {
          if (err) {
            return res.status(500).json('Internal Error')
          }

          app.services.notifications.sockets.send({
            topic: 'session-customer-changed',
            data: {
              model: user,
              model_type: 'User',
              operation: 'update',
              organization: user.current_customer // customer name
            }
          })

          res.send(200, {})
        })
      } else {
        res.send(403,'Forbidden')
      }
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
