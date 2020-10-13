const Mailer = require('./mailer')
const logger = require('../../../logger')('services:notifications:email')
const TopicsConstants = require('../../../constants/topics')

class Email {
  constructor (app, config) {
    this.config = config
    this.mailer = new Mailer(config)
  }

  async sendEvent (event, user) {
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
      throw new Error(`missing subject and body`)
    }

    let message = {
      body: event.data.body,
      subject: event.data.subject
    }

    return this.send(message, user.email)
  }

  send (message, address) {
    return new Promise((resolve, reject) => {
      const mail = {}
      mail.bcc = message.address || address
      mail.html = message.body || message.html
      mail.subject = message.subject

      this.mailer.sendMail(mail, (err, response) => {
        if (err) {
          logger.error(err)
          reject(err)
        } else {
          logger.log(response)
          resolve(response)
        }
      })
    })
  }
}

const isHandledEvent = (event) => {
  // HANDLE
  // monitor state changes
  let verify = (event.topic === TopicsConstants.MONITOR_STATE)
  return verify
}

module.exports = Email
