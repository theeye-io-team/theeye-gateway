const Mailer = require('./mailer')
const logger = require('../../../logger')('services:notifications:email')
const TopicsConstants = require('../../../constants/topics')
const Templates = require('./templates')
const AbstractNotification = require('../abstract')

class Email extends AbstractNotification {
  constructor (app, config) {
    super()

    this.app = app
    this.config = config
    this.mailer = new Mailer(config)
  }

  async sendEvent (event, user) {
    try {
      if (!isHandledEvent(event)) {
        logger.log(`topic dismiss. not handled`)
        // ignore
        return
      }

      if (!user.email) {
        throw new Error(`${user._id} address not set`)
      }

      if (!event.data.subject || !event.data.body) {
        logger.data(event)
        throw new Error(`missing subject and body in event ${event.topic}`)
      }

      const message = {
        body: event.data.body,
        subject: event.data.subject,
        organization: event.data.organization
      }

      return this.send(message, user.email)
    } catch (err) {
      logger.error(err.message)
    }
  }

  send (message, address) {
    const organization = (message.organization || '')
    const from = this.config.from.replace(/%customer%/g, organization)

    const mail = {}
    mail.bcc = message.address || address
    mail.html = message.body || message.html
    mail.subject = message.subject
    mail.from = from

    return this.mailer.sendMail(mail)
  }

  /**
   *
   * @return {Promise}
   *
   */
  sendActivationMessage (input) {
    try {
      if (this.config.message.activation.enabled === false) {
        return
      }

      const app = this.app
      const { user } = input

      const activation_link = this.getTokenLink(
        user.invitation_token,
        app.config.services.registration.activateUrl
      )

      const options = {
        subject: 'TheEye Account Activation',
        body: Templates.activation({
          name: user.name,
          email: user.email,
          activation_link
        })
      }

      return this.send(options, user.email)
    } catch (err) {
      logger.error(err.message)
    }
  }

  /**
   *
   * @return {Promise}
   *
   */
  //sendCustomerInvitationMessage ({ name, email, customer_name }) {
  //  if (this.config.message.customerInvitation.enabled === false) {
  //    return
  //  }
  //  const app = this.app
  //  const options = {
  //    subject: 'TheEye Invitation',
  //    body: Templates.customerInvitation({
  //      name,
  //      email,
  //      customer_name
  //    })
  //  }
  //  return this.send(options, email)
  //}

  /**
   *
   * @return {Promise}
   *
   */
  sendInvitationMessage (input) {
    try {
      if (this.config.message.invitation.enabled === false) {
        return
      }

      const body = Templates.invitation(input)
      const options = { subject: 'TheEye Invitation', body }
      return this.send(options, input.invitee.email)
    } catch (err) {
      logger.error(err.message)
    }
  }

  /**
   *
   * @param {Object} input
   * @return {Promise}
   *
   */
  sendRegistrationMessage (input) {
    try {
      if (this.config.message.registration.enabled === false) {
        return
      }

      const app = this.app
      const { user } = input

      const activation_link = this.getTokenLink(
        user.invitation_token,
        app.config.services.registration.finishUrl
      )

      const options = {
        subject: 'TheEye Registration',
        body: Templates.registration({
          email: user.email,
          name: user.name,
          activation_link
        })
      }

      let addresses = user.email
      if (app.config.services.registration.notifyUs === true) {
        // bcc us
        addresses += `,${app.config.app.supportEmail}`
      }

      return this.send(options, addresses)
    } catch (err) {
      logger.error(err)
    }
  }

  /**
   *
   * @param {Object} input
   * @return {Promise}
   *
   */
  sendPasswordRecoveryToken (input) {
    try {
      const app = this.app
      if (this.config.message.passwordRecover.enabled === false) {
        return
      }

      const { user, token } = input

      if (!app.config.services.registration.passwordResetUrl) {
        throw new Error('missing configuration registration.passwordResetUrl')
      }

      const url = this.getTokenLink(
        token,
        app.config.services.registration.passwordResetUrl
      )

      const body = Templates.passwordRecover({ url, email: user.email, name: user.name })
      const options = {
        to: user.email,
        subject: 'TheEye Password Recover',
        body
      }

      return this.send(options, user.email)
    } catch (err) {
      logger.error(err)
    }
  }

  getTokenLink (token, url) {
    const app = this.app

    if (
      app.config.services.authentication.strategies.ldapauth &&
      !app.config.services.authentication.localBypass
    ) {
      return app.config.app.base_url + '/login'
    }

    const params = JSON.stringify({ token })
    const qs = Buffer.from(params).toString('base64')
    return (url + qs)
  }
}

const isHandledEvent = (event) => {
  // HANDLE
  // monitor state changes
  let verify = (event.topic === TopicsConstants.MONITOR_STATE)
  return verify
}

module.exports = Email
