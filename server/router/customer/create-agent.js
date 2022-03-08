const crypto = require('crypto')
const CredentialsConstants = require('../../constants/credentials')

// @TODO move to IAM service
const create = async (app, customer) => {
  const cliendId = randomToken()
  const clientSecret = randomToken()

  const email = (customer.name + '-agent@theeye.io').toLowerCase()
  const name = (customer.name + '-agent').toLowerCase()

  const agentUser = await app.models.users.botUser.create({
    username: cliendId,
    email,
    name,
    enabled: true,
    onboardingCompleted: true ,
    invitation_token: null,
    devices: null,
    notifications: null ,
    credential: null
  })

  const passport = await app.models.passport.create({
    protocol: 'local',
    provider: 'theeye',
    password: clientSecret,
    identifier: cliendId,
    tokens: {
      access_token: null,
      refresh_token: clientSecret
    },
    user: agentUser._id,
    user_id: agentUser._id
  })

  const member = await app.models.member.create({
    user: agentUser._id,
    user_id: agentUser._id,
    customer: customer._id,
    customer_id:  customer._id,
    customer_name: customer.name,
    credential: CredentialsConstants.AGENT,
    enabled: true
  })

  return agentUser
}

const randomToken = () => crypto.randomBytes(20).toString('hex')

module.exports = create
