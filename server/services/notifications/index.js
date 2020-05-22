const Sockets = require('./sockets')
const Push = require('./push')
const Email = require('./email')

class Notifications {
  constructor (app) {
    let config = app.config.services.notifications

    this.sockets = new Sockets(app, config.sockets)
    this.push = new Push(app, config.push)
    this.email = new Email(app, config.email)
  }
}

module.exports = Notifications
