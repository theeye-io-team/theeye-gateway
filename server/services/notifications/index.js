const Sockets = require('./sockets')
const Push = require('./push')
const Email = require('./email')

class Notifications {
  constructor (config) {
    this.sockets = new Sockets(config.sockets)
    this.push = new Push(config.push)
    this.email = new Email(config.email)
  }
}

module.exports = Notifications
