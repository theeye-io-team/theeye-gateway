const express = require('express')
const mongoose = require('mongoose')
const logger = require('../logger')('router:member')
const emailTemplates = require('../services/notifications/email/templates')

module.exports = (app) => {
  const router = express.Router()

  router.get(
    '/',
    (req, res, next) => {
      const session = req.session

      let query = {
        customer_id: mongoose.Types.ObjectId(session.customer_id)
      }

      let ninCredentials = ['agent', 'integration']
      if (req.user.credential !== 'root') {
        ninCredentials.push('root')
      }

      query.credential = { $nin: ninCredentials }

      app.models
        .member
        .find(query)
        .populate({
          path: 'user',
          select: 'id name username email credential enabled invitation_token devices onboardingCompleted notifications'
        })
        .exec((err, members) => {
          if (err) { res.status(500).json({ message: "Error getting members." }) }
          else {
            res.json(members)
          }
        })
    }
  )

  router.delete(
    '/:id',
    (req, res, next) => {
      if (!req.params.id) {
        return res.status(400).json({ message: "Missing param id." })
      }

      const id = req.params.id

      app.models
        .member
        .findByIdAndRemove(id)
        .exec((err, result) => {
          if (err) { res.status(500).json({ message: "Error removing member." })}
          else { res.status(200).json() }
        })
    }
  )

  router.patch(
    '/:id',
    (req, res, next) => {
      if (!req.params.id) {
        return res.status(400).json({ message: "Missing param id." })
      }

      if (!req.body.credential) {
        return res.status(400).json({ message: "Missing param credential." })
      }

      const id = req.params.id
      const update = {
        credential: req.body.credential
      }

      app.models
        .member
        .findByIdAndUpdate(id,update)
        .exec((err, result) => {
          if (err) { res.status(500).json({ message: "Error updating member credential." })}
          else { res.status(200).json() }
        })

    }
  )

  router.post(
    '/',
    async (req, res, next) => {
      try {
        const session = req.session

        const body = req.body

        if (!body.user.name) {
          let err = Error('Missing param name.')
          err.status = 400
          throw err
        }
        if (!body.user.email) {
          let err = Error('Missing param email.')
          err.status = 400
          throw err
        }
        if (!body.credential) {
          let err = Error('Missing param credential.')
          err.status = 400
          throw err
        }

        let data = {}

        let user = await app.models.user.findOne({email: body.user.email})
        let customer = await app.models.customer.findById(session.customer_id)

        if (!customer) {
          let err = Error('Customer not found.')
          err.status = 400
          throw err
        }

        if (user) {
          //if user exist invite to this customer
          // check if is already member
          let member = await app.models.member.findOne({
            user_id: user._id,
            customer_id: customer._id
          })

          // ya existe reenviar
          if (member) {
            if (user.enabled) {
              let err = Error('activeMember')
              err.status = 400
              throw err
            } else {
              // reenviar invitacion de miembro disabled
              let token = app.service.authentication.issue({ email: user.email })
              user.invitation_token = token
              await user.save()
              member.user = user

              await sendActivationEMail(app, {
                inviter: req.user,
                invitee: user,
                activationLink: getActivationLink(user, app.config.activateUrl)
              })

              return res.status(200).json({ member:member, resend:true })
            }
          } else {
            data = {
              user: user._id,
              user_id: user._id,
              customer: customer._id,
              customer_id:  customer._id,
              customer_name: customer.name,
              credential: body.credential,
              enabled: false
            }

            let newMember = await app.models.member.create(data)
            newMember.user = user

            //enviar mail de invitacion
            await sendNewCustomerEMail(app, {
              invitee: user,
              customerName:customer.name
            })

            return res.status(200).json({ member:newMember, resend:false })
          }
        } else {
          // si el usuario no existe, creo un nuevo
          let token = app.service.authentication.issue({ email: body.user.email })

          let userData = {
            username: body.user.email,
            name: body.user.name,
            email: body.user.email,
            credential: body.credential,
            enabled: false,
            invitation_token: token
          }

          let newUser = await app.models.user.create(userData)
          if (!newUser) { throw new Error("newUser not set.") }

          // creo el member para el nuevo user
          let memberData = {
            user: newUser._id,
            user_id: newUser.id,
            customer: customer._id,
            customer_id: customer._id,
            customer_name: customer.name,
            credential: body.credential,
            enabled: false
          }

          let newMember = await app.models.member.create(memberData)
          newMember.user = newUser

          await sendActivationEMail(app, {
            inviter: req.user,
            invitee: newUser,
            activationLink: getActivationLink(newUser, app.config.activateUrl)
          })

          return res.status(200).json({ member:newMember, resend:false })
        }
      } catch (err) {
        console.log(err)
        if (err.status) { res.status(err.status).json( { message: err.message }) }
        else res.status(500).json('Internal Server Error')
      }
    }
  )

  return router
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

const sendNewCustomerEMail = (app, data) => {
  return new Promise((resolve, reject) => {
    let html = emailTemplates.customerInvitation(data)

    var options = {
      to: data.invitee.email,
      subject:'TheEye Invitation',
      html:html
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
