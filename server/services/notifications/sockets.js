const logger = require('../logger')('libs:notifications:sockets')

const NOTIFICATION_TOPIC = 'notification-crud'
const RESULT_RENDER_TOPIC = 'job-result-render'
const CUSTOMER_CHANGED_TOPIC = 'session-customer-changed'

class Sockets {
  constructor () {
  }

  send (message, next) {
    next || (next = ()=>{})
    return this.emit(message.topic, message, next)
  }

  emit (topic, message, next) {
    logger.debug('emit event %s', topic)

    switch (topic) {
      case NOTIFICATION_TOPIC:
        sendNotificationMessages(message.data, next)
        break;
      case RESULT_RENDER_TOPIC:
        sendUserNotificationMessage(topic, message.data, next)
        break;
      case CUSTOMER_CHANGED_TOPIC:
        sendCustomerChangedMessage (message.data, next)
        break;
      default:
        sendEventMessage (topic, message.data, next)
        break;
    }
  }
}

module.exports = Sockets

const sendNotificationMessages = (data, next) => {
  const topic = NOTIFICATION_TOPIC
  if (Array.isArray(data.model)) {
    // send a socket event for each user notification
    for (let idx in data.model) {
      const model = data.model[idx]
      const room = `${model.data.organization}:${model.user_id}:${topic}`

      logger.debug(`sending message to ${room}`)

      sails.io
        .sockets
        .in(room)
        .emit(topic, Object.assign({}, data, { model }))
    }
    return next()
  } else {
    let msg = `ERROR: invalid notification structure. Array expected, received ${data.model}`
    logger.error(msg)
    return next( new Error(msg) )
  }
}

const sendUserNotificationMessage = (topic, data, next) => {
  const model = data.model
  const user_id = data.user_id
  const room = `${data.organization}:${user_id}:${topic}`

  logger.debug(`sending message to ${room}`)

  sails.io
    .sockets
    .in(room)
    .emit(topic, data)

  return next()
}

const sendCustomerChangedMessage = (data, next) => {
  const topic = CUSTOMER_CHANGED_TOPIC
  const room = `${data.model.id}:${topic}`
  sails.io.sockets.in(room).emit(topic, {
    organization: data.organization
  })
  next()
}

const sendEventMessage = (topic, data, next) => {
  const room = `${data.organization}:${topic}`
  logger.debug(`sending message to ${room}`)
  sails.io.sockets.in(room).emit(topic, data)
  next()
}
