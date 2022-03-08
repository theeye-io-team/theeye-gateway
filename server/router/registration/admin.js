const express = require('express')
const { ClientError, ServerError } = require('../../errors')
const { validateUserData, isUsernameAvailable } = require('../user/data-validate')
const { validateCustomerName } = require('../customer/data-validate')
const createAgentUser = require('../customer/create-agent')

module.exports = (app) => {
  const router = express.Router()

  router.post('/', async (req, res, next) => {
    try {
      const body = req.body
      validateUserData(
        Object.assign({}, body.user, {
          enabled: true
        })
      )

      await isUsernameAvailable(app, body.user)

      await validateCustomerName(app, body.customer.name)

      const result = await registerUser(body)
      res.json(result)
    } catch (err) {
      next(err)
    }
  })

  const registerUser = async (data) => {
    const user = await app.models.users.uiUser.create({
      username: data.user.username.toLowerCase(),
      email: data.user.email.toLowerCase(),
      name: data.user.name,
      enabled: true,
      credential: null,
      invitation_token: null,
      devices: null,
      notifications: null ,
      onboardingCompleted: false
    })

    await app.models.passport.create({
      password: data.user.password,
      protocol: 'local',
      provider: 'theeye',
      user: user._id,
      user_id: user._id
    })

    const customer = await app.models.customer.create({ name: data.customer.name })
    await createAgentUser(app, customer)

    const member = await app.models.member.create({
      user: user._id,
      user_id: user.id,
      customer: customer._id,
      customer_id: customer._id,
      customer_name: customer.name,
      credential: (data.member?.credential || 'user')
    })

    return { user, customer, member }
  }

  return router
}
