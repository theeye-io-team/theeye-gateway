const express = require('express')
const logger = require('../logger')('router:user')
const CredentialsConstants = require('../constants/credentials')
const emailTemplates = require('../services/notifications/email/templates')
const isEmail = require('validator/lib/isEmail')

module.exports = (app) => {
  const router = express.Router()

  router.get(
    '/',
    credentialControl([CredentialsConstants.ROOT]),
    async (req, res, next) => {
      try {
        let query = {}
        let ninCredentials = [CredentialsConstants.AGENT, CredentialsConstants.INTEGRATION]
        query.credential = { $nin: ninCredentials }

        let users = await app.models.users.uiUser.find(query).exec()
        res.json(users)
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }

    }
  )

  router.post(
    '/',
    credentialControl([CredentialsConstants.ROOT]),
    async (req, res, next) => {
      try {
        if (!req.body.hasOwnProperty('enabled')) return res.status(400).json({message: 'enabled is required'})
        if (!req.body.username) return res.status(400).json({message: 'username is required'})
        if (!req.body.name) return res.status(400).json({message: 'name is required'})
        if (!req.body.email) return res.status(400).json({message: 'email is required'})
        if (!validateUsername(req.body.username)) return res.status(400).json({message: 'incorrect username format'})
        if (!isEmail(req.body.email)) return res.status(400).json({message: 'incorrect email format'})

        var data = {
          username: req.body.username,
          name: req.body.name,
          email: req.body.email,
          credential: null,
          enabled: req.body.enabled
        }

        if (data.enabled) {
          if (!req.body.password) return res.status(400).json({message: 'password is required'})
          if(req.body.password !== req.body.confirmPassword) return res.status(400).json({message: 'passwords dont match'})
          if(req.body.password.length < 8) return res.status(400).json({message: 'password should have at least 8 characters'})
          data.password = req.body.password
        }

        let prevUser = await app.models.users.uiUser.findOne({$or:[
          {email: data.email},
          {username: data.username}
        ]})

        if (prevUser) {
          if (prevUser.username == data.username) return res.status(400).json({message: 'The username is taken. Choose another one'})
          if (prevUser.email == data.email) return res.status(400).json({message: 'The email is taken. Choose another one'})
        } else {
          let newUser = await createUser(app, req.user, data)
          res.json(newUser)
        }
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  router.put(
    '/:id',
    credentialControl([CredentialsConstants.ROOT]),
    async (req, res, next) => {
      try {
        const id = req.params.id

        if (!req.body.hasOwnProperty('enabled')) return res.status(400).json({message: 'enabled is required'})
        if (!req.body.username) return res.status(400).json({message: 'username is required'})
        if (!req.body.name) return res.status(400).json({message: 'name is required'})
        if (!req.body.email) return res.status(400).json({message: 'email is required'})
        if (!validateUsername(req.body.username)) return res.status(400).json({message: 'incorrect username format'})
        if (!isEmail(req.body.email)) return res.status(400).json({message: 'incorrect email format'})

        let user = await app.models.users.uiUser.findById(id)
        if (!user) {
          let err = new Error('User Not Found')
          err.status = 404
          throw err
        }

        user.set({
          name: req.body.name,
          username: req.body.username,
          email: req.body.email,
          enabled: req.body.enabled
        })

        await user.save()
        res.json(user)
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  router.delete(
    '/:id',
    credentialControl([CredentialsConstants.ROOT]),
    async (req, res, next) => {
      try {
        const id = req.params.id

        let user = await app.models.users.uiUser.findById(id)
        if (!user) {
          let err = new Error('User Not Found')
          err.status = 404
          throw err
        }

        await app.models.passport.deleteMany({user_id: user._id})
        await app.models.member.deleteMany({user_id: user._id})

        await user.remove()

        res.json({})
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  router.put(
    '/:id/reinvite',
    credentialControl([CredentialsConstants.ROOT]),
    async (req, res, next) => {
      try {
        const id = req.params.id

        let user = await app.models.users.uiUser.findById(id)
        if (!user) {
          let err = new Error('User Not Found')
          err.status = 404
          throw err
        }

        if (user.enabled === true) {
          await sendInvitationEMail(app, {
            inviter: req.user,
            invitee: user
          })
        } else {
          const token = app.service.authentication.issue({ email: user.email })
          user.set({invitation_token: token})

          await user.save()

          await sendActivationEMail(app, {
            inviter: req.user,
            invitee: user,
            activationLink: getActivationLink(user, app.config.activateUrl)
          })
        }

        res.json(user)
      } catch (err) {
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  return router
}

const createUser = async (app, inviter, data) => {
  let userData = {
    username: data.username,
    email: data.email,
    name: data.name,
    enabled: data.enabled,
    credential: null,
    invitation_token: null,
    devices: null,
    notifications: null ,
    onboardingCompleted: false
  }

  if(!data.enabled) {
    userData.invitation_token = app.service.authentication.issue({ email: data.email })
  }

  let newUser = await app.models.users.uiUser.create(userData)

  if (newUser.enabled===true) {
    let passportData = {
      protocol: 'local',
      provider: 'theeye',
      password: data.password,
      user: newUser._id,
      user_id: newUser._id
    }

    await app.models.passport.create(passportData)

    await sendInvitationEMail(app, {
      inviter: inviter,
      invitee: newUser
    })
  } else {
    await sendActivationEMail(app, {
      inviter: inviter,
      invitee: newUser,
      activationLink: getActivationLink(newUser, app.config.activateUrl)
    })
  }

  return newUser
}

const getActivationLink = function (user, activateUrl) {
  let queryToken = new Buffer( JSON.stringify({ invitation_token: user.invitation_token }) ).toString('base64')
  let url = activateUrl
  return (url + queryToken)
}

const sendActivationEMail = (app, data) => {
  return new Promise((resolve, reject) => {
    let html = emailTemplates.activation(data)

    var options = {
      to: data.invitee.email,
      subject: 'TheEye Account Activation',
      html: html
    }

    app.service.notifications.email.send(options, function(err) {
      if (err) {
        let err = Error('Error sending activation email.')
        err.status = 500
        reject(err)
      }
      resolve()
    })
  })
}

const sendInvitationEMail = (app, data) => {
  return new Promise((resolve, reject) => {
    let html = emailTemplates.invitation(data)

    var options = {
      to: data.invitee.email,
      subject: 'TheEye Invitation',
      html: html
    }

    app.service.notifications.email.send(options, function(err) {
      if (err) {
        let err = Error('Error sending invitation email.')
        err.status = 500
        reject(err)
      }
      resolve()
    })
  })
}

const validateUsername = (username) => {
  return (isEmail(username) || isEmail(username + '@theeye.io'))
}

const credentialControl = (requiredCredentials) => {
  return (req, res, next) => {
    const checkCredentials = (credential, accepted) => {
      return (accepted.indexOf(credential) !== -1)
    }

    let hasAccessLevel= checkCredentials(req.session.credential, requiredCredentials)
    if(!hasAccessLevel) {
      return res.status(403).json('Forbidden')
    }
    return next()
  }
}
