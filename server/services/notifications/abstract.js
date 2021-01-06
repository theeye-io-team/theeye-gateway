
class AbstractNotification {
  constructor () {
  }

  sendEvent () {
    throw new Error('Implementation Required')
  }
}

module.exports = AbstractNotification
