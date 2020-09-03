const Sockets = require('./sockets')
const Push = require('./push')
const Email = require('./email')
const Messages = require('./messages')

class Notifications {
  constructor (app) {
    this.app = app
    let config = app.config.services.notifications

    this.sockets = new Sockets(app, config.sockets)
    this.push = new Push(app, config.push)
    this.email = new Email(app, config.email)
    this.messages = new Messages(app, config.messages)
  }

  eventNotifySupport ({ subject, body }) {
    // email event
    this.email.send({
      subject,
      body,
      address: this.app.config.app.supportEmail
    })
  }
}

module.exports = Notifications
