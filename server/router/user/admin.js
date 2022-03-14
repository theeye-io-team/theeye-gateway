const express = require('express')
const dbFilterMiddleware = require('../db-filter-middleware')
const { ClientError, ServerError } = require('../../errors')
const { validateUserData, isUserKeyAvailable } = require('./data-validate')

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
      await isUserKeyAvailable(app, body)

      const data = {
        username: body.username.toLowerCase(),
        email: body.email.toLowerCase(),
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

      const user = await app.models.users.uiUser.findById(id)
      if (!user) {
        throw new ClientError('User not found', { statusCode: 404 })
      }

      validateUserData(body)
      await isUserKeyAvailable(app, body, user)

      user.set({
        username: body.username.toLowerCase(),
        email: body.email.toLowerCase(),
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
