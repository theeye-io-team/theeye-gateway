const express = require('express')
const isEmail = require('validator/lib/isEmail')
const EscapedRegExp = require('../../escaped-regexp')
const dbFilterMiddleware = require('../db-filter-middleware')
const { ClientError, ServerError } = require('../../errors')
const { validateUserData, isUserKeyAvailable } = require('./data-validate')

const TOKEN_REASON = 'email verification'

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
        password: body.password,
        tags: body.tags
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
        enabled: body.enabled,
        tags: body.tags
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
  
  router.post('/email/verify', async (req, res, next) => {
    try {
      const email = req.body.email

      if (!email || typeof email !== 'string' || !isEmail(email)) {
        throw new ClientError('Email Required')
      }

      const user = await app.models.users.uiUser.findOne({
        email: new EscapedRegExp(email,'i')
      })

      if (!user) {
        throw new ClientError('User not found', { statusCode: 404 })
      }

      const token = app.service
        .authentication
        .issue({
          email: user.email,
          origin: req.user._id.toString(), // a root user
          target: user._id.toString(),
          reason: TOKEN_REASON
        }, {
          //expiresIn: "24h"
        })

      user.security_token = token
      user.email_verified = false
      await user.save()

      res.send({ token })
    } catch (err) {
      next(err)
    }
  })

  router.post('/email/verify/confirmation', async (req, res, next) => {
    try {
      const token = req.body.token

      if (!token) {
        throw new ClientError('Invalid Token')
      }

      const decoded = app.service.authentication.verify(token)

      if (!decoded.email) {
        throw new ClientError('Recovery Token is not valid')
      }

      const user = await app.models.users.uiUser.findOne({
        email: new EscapedRegExp(decoded.email,'i'),
        security_token: token
      })

      if (!user) {
        throw new ClientError('Recovery Token is no longer valid')
      }

      if (decoded.reason !== TOKEN_REASON || decoded.target !== user._id.toString()) {
        throw new ClientError('Recovery Token is not valid')
      }

      if (decoded.origin !== req.user._id.toString()) {
        throw new ClientError('The session is not allowed to perform this action', { statusCode: 403 })
      }

      user.security_token = null
      user.email_verified = true
      await user.save()

      res.send('ok')
    } catch (err) {
      next(err)
    }
  })

  router.post('/email/disable', async (req, res, next) => {
    try {
      const email = req.body.email

      if (!email || typeof email !== 'string' || !isEmail(email)) {
        throw new ClientError('Email Required')
      }

      const user = await app.models.users.uiUser.findOne({
        email: new EscapedRegExp(email,'i')
      })

      if (!user) {
        throw new ClientError('User not found', { statusCode: 404 })
      }

      user.email_verified = false
      user.security_token = null
      await user.save()

      res.send('ok')
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
