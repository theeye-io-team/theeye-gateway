const logger = require('../../logger')(':services:notifications:sockets')
const socketIO = require('socket.io')
const socketIOredis = require('socket.io-redis')
const TopicConstants = require('../../constants/topics')

module.exports = function (app, config) {
  class Sockets {
    constructor () {
      this.config = config
      this.io
    }

    start (server) {
      const io = this.io = socketIO.listen(server)
      io.adapter(socketIOredis(this.config.redis))
      io.sockets.on('connection', function onConnection (socket) {
        logger.log('user connected')
        let handler = new SocketHandler(socket)
      })
    }

    sendEvent (message, next) {
      try {
        emitEvent(this.io, message.topic, message)
        next && next()
      } catch (err) {
        logger.error(err)
        next(err)
      }
    }
  }

  function SocketHandler (socket) {
    // extend
    var $on = socket.on
    socket.on = function (eventName, handler) {
      $on.call(socket, eventName, function () {
        logger.debug('socket event receive %s, %o', eventName, arguments[0])
        if (!handler) { logger.log(`no handled for socket event ${eventName}`) }
        else { handler.apply(socket, arguments) }
      })
    }

    for (let eventName in SocketEvents) {
      socket.on(eventName, middlewares(socket, eventName, SocketEvents[eventName]))
    }

    return this
  }

  const SocketEvents = {
    'disconnect': (req, next) => {
      logger.log('user disconnected')
      const socket = req.socket
      next({ status: 200 })
    },
    'post:autosubscribe': (req, next) => {
      //const user = req.user
      const socket = req.socket
      const session = req.session
      const session_id = session._id.toString()
      const user_id = session.user_id.toString()
      const customer_id = session.customer_id.toString()

      // auto subscribed topics
      const topics = [
        TopicConstants.MONITOR_STATE,
        TopicConstants.HOST_REGISTERED,
        //TopicConstants.CRUD,
        TopicConstants.JOB_CRUD,
        TopicConstants.JOB_SCHEDULER_CRUD,
        TopicConstants.INDICATOR_CRUD,
        TopicConstants.HOST_INTEGRATIONS_CRUD,
        TopicConstants.MESSAGE_CRUD,
      ]

      const joinRoom = (room) => {
        socket.join(room)
        logger.debug('client auto-subscribed to %s', room)
      }

      // session subscriptions
      joinRoom(`${customer_id}:${user_id}:${TopicConstants.NOTIFICATION_CRUD}`)
      joinRoom(`${customer_id}:${user_id}:${TopicConstants.JOB_RESULT_RENDER}`)
      joinRoom(`${session_id}:${user_id}:${TopicConstants.SESSION}`)

      topics.forEach(topic => joinRoom(`${customer_id}:${topic}`))

      next({ status: 200, body: { message: 'auto-subscription success' } })
    },
    'post:subscribe': (req, next) => {
      const socket = req.socket
      const customer_id = req.session.customer_id.toString()
      const topics = req.params.topics

      if (!Array.isArray(topics) || topics.length === 0) {
        return next({ status: 400, body: { message: 'nothing to subscribe' } })
      }

      if (!topics.every(topic => Object.values(TopicConstants).indexOf(topic) !== -1) ) {
        return next({ status: 400, body: { message: 'invalid topics' } })
      }

      for (let topic of topics) {
        let room = `${customer_id}:${topic}`
        socket.join(room)
        logger.debug('client subscribed to %s', room)
      }

      next({ status: 200, body: { message: 'subscription success' } })
    },
    'post:unsubscribe': (req, next) => {
      const customer_id = req.session.customer_id.toString()
      const socket = req.socket

      let topics = req.params.topics

      if (!topics) { // unsubscribe all
        for (let room in socket.rooms) {
          let msg = `client leaving room ${room}`
          logger.debug(msg)
          socket.leave(room)
        }
      } else {
        for (let topic of topics) {
          let room = `${customer_id}:${topic}`
          let msg = `client leaving room ${room}`
          logger.debug(msg)
          socket.leave(room)
        }
      }

      next({ status: 200 })
    },
    'get:subscriptions': (req, next) => {
      const socket = req.socket
      let myRooms = socket.rooms[req.socket.id]
      next({ status: 200, body: Object.keys(myRooms) })
    }
  }


  const tokenVerify = (socket, next) => {
    const unauthorized = () => {
      let message = 'authentication error'
      next(new Error(message))
    }

    const disconnect = () => {
      let message = 'authentication error'
      next(new Error(message))
      logger.error('unauthorized socket client disconnected')
      socket.disconnect()
    }

    if (socket.handshake.query && socket.handshake.query.access_token) {
      let token = socket.handshake.query.access_token
      app.service.authentication.verifySessionToken(token, (err, user, session) => {
        if (err) {
          logger.error(err)
          unauthorized()
        } else {
          next(null, user, session)
        }
      })
    } else {
      disconnect()
    }
  }

  const middlewares = (socket, eventName, handler) => {
    return (params, next) => {
      next || (next=()=>{})
      if (eventName === 'disconnect') {
        handler({socket}, next)
      } else {
        logger.log('authentication middleware')
        tokenVerify(socket, (err, user, session) => {
          if (err) {
            logger.error(err.message)
            next({ status: 401, message: err.message })
          } else {
            handler({ socket, user, session, params }, next)
          }
        })
      }
    }
  }

  const emitEvent = (io, topic, message) => {
    const data = message.data
    logger.debug('emit event "%s"', topic)

    switch (topic) {
      case TopicConstants.NOTIFICATION_CRUD:
        //sendNotificationMessages(io, topic, data)
        //break;
      case TopicConstants.JOB_RESULT_RENDER:
        sendOrganizationUserEvent(io, topic, data)
        break;
      case TopicConstants.SESSION:
        const room = `${data.model._id}:${data.model.user_id}:${TopicConstants.SESSION}`
        logger.debug(`sending message to ${room}`)
        io.sockets.in(room).emit(topic, data)
        break;
      default:
        sendOrganizationEvent (io, topic, data)
        break;
    }
  }

  //const sendNotificationMessages = (io, topic, data) => {
  //  if (!Array.isArray(data.model)) {
  //    let msg = `ERROR: invalid notification structure. Array expected, received ${data.model}`
  //    logger.error(msg)
  //    throw new Error(msg)
  //  }
  //  // send a socket event for each user that need to be notified
  //  // @TODO: user and organization should not be read from model.
  //  // model is internal implementation of the message. must be abstracted
  //  for (let idx in data.model) {
  //    const model = data.model[idx]
  //    const room = `${model.data.organization_id}:${model.user_id}:${topic}`
  //    logger.debug(`sending message to ${room}`)
  //    let payload = Object.assign({}, data, { model })
  //    io.sockets.in(room).emit(topic, payload)
  //  }
  //}

  const sendOrganizationUserEvent = (io, topic, data) => {
    const user_id = data.user_id
    const room = `${data.organization_id}:${user_id}:${topic}`
    logger.debug(`sending message to ${room}`)
    io.sockets.in(room).emit(topic, data)
  }

  const sendUserEvent = (io, topic, data) => {
    const room = `${data.model.id}:${topic}`
    logger.debug(`sending message to ${room}`)
    io.sockets.in(room).emit(topic, data)
  }

  const sendOrganizationEvent = (io, topic, data) => {
    const room = `${data.organization_id}:${topic}`
    logger.debug(`sending message to ${room}`)
    io.sockets.in(room).emit(topic, data)
  }

  return new Sockets()
}
