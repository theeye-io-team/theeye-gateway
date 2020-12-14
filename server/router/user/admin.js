const express = require('express')
const isEmail = require('validator/lib/isEmail')
const logger = require('../../logger')('router:user')
const CredentialsConstants = require('../../constants/credentials')
const dbFilterMiddleware = require('../db-filter-middleware')
const { ClientError, ServerError } = require('../../errors')

module.exports = (app) => {
  const router = express.Router()

  router.get('/fetch', dbFilterMiddleware({}), async (req, res, next) => {
    try {
      const dbFilters = req.filters
      const users = await app.models.users.uiUser.apiFetch(dbFilters)
      res.json(users)
    } catch (err) {
      next(err)
    }
  })

  router.get('/', async (req, res, next) => {
    try {
      const users = await app.models.users.uiUser.find()
      res.json(users)
    } catch (err) {
      next(err)
    }
  })

  router.post('/', async (req, res, next) => {
    try {
      const body = req.body
      validateUserData(body)

      const { email, username } = body
      let user = await app.models.users.user.findOne({
        $or: [
          { email: new RegExp(email, 'i') },
          { username: new RegExp(username, 'i') }
        ]
      })

      if (user) {
        if (user.username.toLowerCase() === username.toLowerCase()) {
          throw new ClientError('Username is in use. Choose another one')
        }
        if (user.email.toLowerCase() === email.toLowerCase()) {
          throw new ClientError('Email is in user. Choose another one')
        }
      }

      const data = {
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        name: body.name,
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

      const { email, username } = body

      // search users sharing username/email
      const usedKey = await app.models.users.user.findOne({
        _id: { $ne: user._id },
        $or: [
          { email: new RegExp(email, 'i') },
          { username: new RegExp(username, 'i') }
        ]
      })

      if (usedKey) {
        if (usedKey.username.toLowerCase() === username.toLowerCase()) {
          throw new ClientError('Username in use. Choose another one')
        }
        if (usedKey.email.toLowerCase() === email.toLowerCase()) {
          throw new ClientError('Email in user. Choose another one')
        }
      }

      user.set({
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        name: body.name,
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
        await app.service
          .notifications
          .email
          .sendInvitationMessage({
            inviter: req.user,
            invitee: user
          })
      } else {
        user.invitation_token = app.service.authentication.issue({ email: user.email })
        await app.service
          .notifications
          .email
          .sendActivationMessage({ user })
        await user.save()
      }

      res.json(user)
    } catch (err) {
      next(err)
    }
  })

  /**
   * @param {User} inviter
   * @param {Object} data
   * @return {User}
   */
  const createUser = async (inviter, data) => {
    const user = await app.models.users.uiUser.create({
      username: data.username.toLowerCase(),
      email: data.email.toLowerCase(),
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

      await app.service
        .notifications
        .email
        .sendInvitationMessage({
          inviter,
          invitee: user
        })
    } else {
      user.invitation_token = app.service.authentication.issue({ email: user.email })
      await app.service
        .notifications
        .email
        .sendActivationMessage({ user })
      await user.save()
    }

    return user
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

const validateUsername = (username) => {
  return (isEmail(username) || isEmail(username + '@theeye.io'))
}
