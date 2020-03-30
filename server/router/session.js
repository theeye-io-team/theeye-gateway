const express = require('express')
const router = express.Router()

const Notifications = require('../libs/notifications')

router.post('/customer/:customer', controller.currentCustomer)

router.post('/refresh', controller.refreshAccessToken)

router.get('/profile', controller.sessionProfile)

router.put('/profile/settings', controller.updateSettings)

router.put('/profile/onboarding', controller.updateOnboarding)

// activateuser
router.post('/activateuser', (req, res) => { })

// registeruser
router.post('/registeruser', (req, res) => { })

// verifyInvitationToken
router.post('/verifytoken', (req, res) => { })

module.exports = router

const controller = {
  refreshAccessToken (req, res, next) {
    const user = req.user
    const accessToken = jwtoken.issue({ user_id: user.id })
    return res.send(200, {
      access_token: accessToken
    })
  },

  currentCustomer (req, res, next) {
    const customer = req.params.customer
    const user = req.user

    if (user.customers.indexOf(customer) !== -1) {
      user.current_customer = customer
      user.save(err => {
        if (err) {
          return res.status(500).json('Internal Error')
        }

        Notifications.sockets.send({
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
  },

  sessionProfile (req, res, next) {
    const user = req.user

    Passport.findOne({
      user: user.id,
      protocol: 'theeye'
    }, (err, theeye) => {
      if (err) return res.send(500,err)

      user.theeye = theeye
      const customers = theeye.profile.customers

      if (
        ! customers ||
        ! Array.isArray(customers) ||
        customers.length === 0
      ) {
        return res.send(500, 'error fetching profile. profile customers are empty.')
      }

      const current_customer = customers.find(c => c.name == user.current_customer)

      if (!current_customer) {
        return res.send(500,'error fetching profile. profile customer not found.')
      }

      req.supervisor.get({
        //replace this route
        //route: `/customer/${current_customer.name}`,
        route: `${current_customer.name}/customer`,
        success: customer => {
          user.current_customer = customer
          res.send(200, user)
        },
        failure: err => {
          console.error(err)
          res.send(500,'error fetching profile')
        }
      })
      //return res.json(user)
    })
  },

  updateSettings (req, res, next) {
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
  },

  updateOnboarding (req, res, next) {
    const user = req.user
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
}
