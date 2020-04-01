const Sockets = require('./sockets')
const Push = require('./push')
const Email = require('./email')

class Notifications {
  constructor (app) {
    let config = app.config.services.notifications

    this.sockets = new Sockets(config.sockets)
    this.push = new Push(config.push)
    this.email = new Email(config.email)
  }
}

module.exports = Notifications
