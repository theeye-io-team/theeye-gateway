const express = require('express')
const { ClientError, ServerError } = require('../../errors')
const { validateUserData, isUserKeyAvailable } = require('../user/data-validate')
const { create: createCustomer } = require('../customer/common')

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

      await isUserKeyAvailable(app, body.user)

      const result = await register(body)
      res.json(result)
    } catch (err) {
      next(err)
    }
  })

  const register = async (data) => {
    if (!data.user.username) {
      data.user.username = data.user.email
    }

    const user = await registerUser(data.user)

    if (!data.customer) { data.customer = {} }
    data.customer.display_name = user.username
    data.customer.owner = user._id
    data.customer.owner_id = user._id
    const customer = await createCustomer(app, data.customer)

    const member = await app.models.member.create({
      user: user._id,
      user_id: user.id,
      customer: customer._id,
      customer_id: customer._id,
      customer_name: customer.name,
      credential: 'owner'
    })

    return { user, customer, member }
  }

  const registerUser = async (data) => {
    const user = await app.models.users.uiUser.create({
      username: data.username.toLowerCase(),
      email: data.email.toLowerCase(),
      name: (data.name || ""),
      enabled: true,
      credential: null,
      invitation_token: null,
      devices: null,
      notifications: null ,
      onboardingCompleted: false
    })

    await app.models.passport.create({
      password: data.password,
      protocol: 'local',
      provider: 'theeye',
      user: user._id,
      user_id: user._id
    })

    return user
  }

  return router
}
