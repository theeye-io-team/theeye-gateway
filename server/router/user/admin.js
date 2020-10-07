const express = require('express')
const logger = require('../../logger')('router:user')
const CredentialsConstants = require('../../constants/credentials')
const emailTemplates = require('../../services/notifications/email/templates')
const isEmail = require('validator/lib/isEmail')

const { ClientError, ServerError } = require('../../errors')

module.exports = (app) => {
  const router = express.Router()

  router.get('/', async (req, res, next) => {
    try {
      let users = await app.models.users.uiUser.find()
      res.json(users)
    } catch (err) {
      next(err)
    }
  })

  router.post('/', async (req, res, next) => {
    try {
      const body = req.body
      validateUserData(body)

      let { email, username } = body
      let user = await app.models.users.user.findOne({
        $or: [ { email }, { username } ]
      })

      if (user) {
        if (user.username == username) {
          throw new ClientError('Username is in use. Choose another one')
        }
        if (user.email == email) {
          throw new ClientError('Email is in user. Choose another one')
        }
      }

      const data = {
        username: body.username,
        name: body.name,
        email: body.email,
        enabled: body.enabled,
        password: body.password
      }

      user = await createUser(req.user, data)
      res.json(user)
    } catch (err) {
      next(err)
    }
  })

  router.put('/:id', async (req, res, next) => {
    try {
      const body = req.body
      const id = req.params.id

      validateUserData(body)

      const user = await app.models.users.uiUser.findById(id)
      if (!user) {
        throw new ClientError('User not found', { statusCode: 404 })
      }

      user.set({
        name: body.name,
        username: body.username,
        email: body.email,
        enabled: body.enabled
      })

      await user.save()
      res.json(user)
    } catch (err) {
      next(err)
    }
  })

  router.delete('/:id', async (req, res, next) => {
    try {
      const id = req.params.id
      const user = await app.models.users.uiUser.findById(id)
      if (!user) {
        throw new ClientError('User not found', { statusCode: 404 })
      }

      await app.models.passport.deleteMany({ user_id: user._id })
      await app.models.member.deleteMany({ user_id: user._id })
      await user.remove()

      res.json({})
    } catch (err) {
      next(err)
    }
  })

  router.put('/:id/reinvite', async (req, res, next) => {
    try {
      const id = req.params.id
      const user = await app.models.users.uiUser.findById(id)
      if (!user) {
        throw new ClientError('User not found', { statusCode: 404 })
      }

      if (user.enabled === true) {
        await sendInvitationEMail(app, { inviter: req.user, invitee: user })
      } else {
        const token = app.service.authentication.issue({ email: user.email })
        user.set({ invitation_token: token })
        await user.save()

        await sendActivationEMail(app, {
          name: user.name,
          email: user.email,
          activation_link: getActivationLink(user.invitation_token, app.config.activateUrl)
        })
      }

      res.json(user)
    } catch (err) {
      next(err)
    }
  })

  const createUser = async (inviter, data) => {
    const user = await app.models.users.uiUser.create({
      username: data.username,
      email: data.email,
      name: data.name,
      enabled: data.enabled,
      credential: null,
      invitation_token: null,
      devices: null,
      notifications: null ,
      onboardingCompleted: false
    })

    if (user.enabled === true) {
      await app.models.passport.create({
        protocol: 'local',
        provider: 'theeye',
        password: data.password,
        user: user._id,
        user_id: user._id
      })
      await sendInvitationEMail(app, { inviter, invitee: user })
    } else {
      user.invitation_token = app.service.authentication.issue({ email: data.email })
      await sendActivationEMail(app, {
        name: user.name,
        email: user.email,
        activation_link: getActivationLink(user.invitation_token, app.config.activateUrl)
      })
      await user.save()
    }

    return user
  }

  const getActivationLink = (invitation_token, activate_url) => {
    if (app.config.services.authentication.strategies.ldapauth) {
      return app.config.app.base_url + '/login'
    }

    let params = JSON.stringify({ invitation_token })
    let query = Buffer.from(params).toString('base64')
    return (activate_url + query)
  }

  return router
}

const validateUserData = (data) => {
  if (typeof data.enabled !== 'boolean') {
    throw new ClientError('enabled is required')
  }
  if (!data.username) {
    throw new ClientError('username is required')
  }
  if (!validateUsername(data.username)) {
    throw new ClientError('username is invalid')
  }
  if (!data.name) {
    throw new ClientError('name is required')
  }
  if (!data.email) {
    throw new ClientError('email is required')
  }
  if (!isEmail(data.email)) {
    throw new ClientError('email is invalid')
  }
  if (data.password) {
    if (data.password !== data.confirmPassword) {
      throw new ClientError('Passwords doesn\'t match')
    }
    if (data.password.length < 8) {
      throw new ClientError('Passwords should be at least 8 characters long')
    }
  }
}

const sendActivationEMail = (app, data) => {
  let options = {
    subject: 'TheEye Account Activation',
    body: emailTemplates.activation(data)
  }

  return app.service.notifications.email.send(options, data.email)
}

const sendInvitationEMail = async (app, data) => {
  let html = emailTemplates.invitation(data)
  var options = { subject: 'TheEye Invitation', body: html }
  await app.service.notifications.email.send(options, data.invitee.email)
}

const validateUsername = (username) => {
  return (isEmail(username) || isEmail(username + '@theeye.io'))
}
