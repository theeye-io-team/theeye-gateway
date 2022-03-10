const express = require('express')
const { ClientError, ServerError } = require('../../errors')
const { validateUserData, validUsername, isUsernameAvailable } = require('../user/data-validate')
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

      const result = await register(body)
      res.json(result)
    } catch (err) {
      next(err)
    }
  })

  const register = async (data) => {
    const customer = await registerCustomer(data.customer)

    const user = await registerUser(data.user)

    const member = await app.models.member.create({
      user: user._id,
      user_id: user.id,
      customer: customer._id,
      customer_id: customer._id,
      customer_name: customer.name,
      credential: 'owner'
    })

    customer.owner = user
    customer.owner_id = user._id
    await customer.save()

    return { user, customer, member }
  }

  const registerCustomer = async (data) => {
    const name = data.name
    let customer = await app.models.customer.findOne({ name })
    if (!customer) {
      if (!validUsername(data.name.toLowerCase())) {
        throw new ClientError('The organization name can contains 6 to 20 letters (a-z), numbers (0-9), period (.), underscore (_) and hyphen (-)')
      }

      customer = await app.models.customer.create({ name: data.name })
      await createAgentUser(app, customer)
    } else {
      throw new ClientError('The organization name is in use. Choose another')
    }

    return customer
  }

  const registerUser = async (data) => {
    const user = await app.models.users.uiUser.create({
      username: data.username.toLowerCase(),
      email: data.email.toLowerCase(),
      name: data.name,
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
