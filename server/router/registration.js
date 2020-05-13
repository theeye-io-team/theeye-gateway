const express = require('express')
const logger = require('../logger')('router:registration')
const isEmail = require('validator/lib/isEmail')

module.exports = (app) => {
  const router = express.Router()

  router.get(
    '/verifyinvitationtoken',
    async (req, res, next) => {
      try {
        if (!req.query.invitation_token) return res.status(400).json({message: 'invitation_token is required'})

        const invitation_token = req.query.invitation_token
        let decoded = app.service.authentication.verify(invitation_token)
        let email = decoded.email

        if (!email) {
          let err = new Error('Invalid invitation_token')
          err.status = 400
          throw err
        }

        let query = {
          invitation_token: invitation_token,
          email: email,
          enabled: false
        }
        let fields = 'username email invitation_token'

        let user = await app.models.users.uiUser.findOne(query, fields).exec()
        if (!user) {
          let err = new Error('User Not Found')
          err.status = 404
          throw err
        }

        res.json(user)
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  router.post(
    '/activate',
    async (req, res, next) => {
      try {
        if (!req.body.invitation_token) return res.status(400).json({message: 'invitation_token is required'})
        if (!req.body.password) return res.status(400).json({message: 'password is required'})
        if (!req.body.email) return res.status(400).json({message: 'email is required'})
        if (!req.body.username) return res.status(400).json({message: 'username is required'})
        if (!validateUsername(req.body.username)) return res.status(400).json({message: 'incorrect username format'})

        const invitation_token = req.body.invitation_token
        let decoded = app.service.authentication.verify(invitation_token)
        if (!decoded.email || (decoded.email !== req.body.email)) {
          let err = new Error('Invalid invitation_token')
          err.status = 400
          throw err
        }

        let body = req.body

        // check if username is taken
        let prevUser = await app.models.users.uiUser.findOne({username: body.username}).exec()
        if (prevUser) {
          let err = new Error('usernameTaken')
          err.status = 400
          throw err
        }

        // activate user
        let query = {
          invitation_token: body.invitation_token,
          email: body.email,
          enabled: false
        }

        let user = await app.models.users.uiUser.findOne(query).exec()
        if (!user) {
          let err = new Error('User Not Found')
          err.status = 404
          throw err
        }

        // authenticate user
        let member = await app.models.member.findOne({user_id: user._id})
        if (!member) {
          let err = new Error('Member Not Found')
          err.status = 404
          throw err
        }

        user.set({ enabled: true, username: body.username })
        await user.save()

        // create passport
        let passportData = {
          protocol: 'local',
          provider: 'theeye',
          password: body.password,
          user: user._id,
          user_id: user._id
        }

        let passport = await app.models.passport.create(passportData)

        const session = await app.service.authentication.createSession({ member, protocol: passport.protocol })
        res.json({ access_token: session.token })
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  return router
}

const validateUsername = (username) => {
  return (isEmail(username) || isEmail(username + '@theeye.io'))
}
