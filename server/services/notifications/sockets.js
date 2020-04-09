const logger = require('../../logger')(':services:notifications:sockets')
const socketIO = require('socket.io')
const socketIOredis = require('socket.io-redis')
const TopicConstants = require('../../constants/topics')

const NOTIFICATION_TOPIC = 'notification-crud'
const RESULT_RENDER_TOPIC = 'job-result-render'
//const CUSTOMER_CHANGED_TOPIC = 'session-customer-changed'

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

    send (message, next) {
      next || (next = ()=>{})
      return this.emit(message.topic, message, next)
    }

    emit (topic, message, next) {
      logger.debug('emit event "%s"', topic)

      switch (topic) {
        case NOTIFICATION_TOPIC:
          sendNotificationMessages(this.io, message.data, next)
          break;
        case RESULT_RENDER_TOPIC:
          sendUserNotificationMessage(this.io, topic, message.data, next)
          break;
        //case CUSTOMER_CHANGED_TOPIC:
        //  logger.error('==========')
        //  logger.error('DEPRECATED')
        //  logger.error('==========')
        //  sendSessionMessage (this.io, message.data, next)
        //  break;
        default:
          sendEventMessage (this.io, topic, message.data, next)
          break;
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
      joinRoom(`${customer_id}:${user_id}:notification-crud`)
      joinRoom(`${customer_id}:${user_id}:job-result-render`)
      joinRoom(`${session_id}:${user_id}:session`)

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

      if (!topics.every(topic => topic in TopicConstants)) {
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

      var logops = []

      let topics = req.params.topics

      if (!topics) { // unsubscribe all
        let myRooms = socket.manager.roomClients[socket.id]
        for (var roomName in myRooms) {
          if (myRooms[roomName]===true) {
            let trueName = roomName.substring(1)
            // remove leading / from roomName, dont know why it has a leading /
            socket.leave(trueName, function(){
              let msg = `client leave room ${trueName}`
              logops.push(msg)
              logger.debug(msg)
            })
          }
        }
      } else {
        topics.forEach(topic => {
          let roomName = `${customer_id}:${topic}`
          socket.leave(roomName, function(){
            let msg = `client leave room ${roomName}`
            logops.push(msg)
            logger.debug(msg)
          })
        })
      }

      next({ status: 200, body: logops })
    },
    'get:subscriptions': (req, next) => {
      const socket = req.socket
      let myRooms = socket.manager.roomClients[req.socket.id]
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

  const sendNotificationMessages = (io, data, next) => {
    const topic = NOTIFICATION_TOPIC
    if (Array.isArray(data.model)) {
      // send a socket event for each user notification
      for (let idx in data.model) {
        const model = data.model[idx]
        const room = `${model.data.organization_id}:${model.user_id}:${topic}`

        logger.debug(`sending message to ${room}`)

        io.sockets
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

  const sendUserNotificationMessage = (io, topic, data, next) => {
    const model = data.model
    const user_id = data.user_id
    const room = `${data.organization_id}:${user_id}:${topic}`

    logger.debug(`sending message to ${room}`)

    io.sockets
      .in(room)
      .emit(topic, data)

    return next()
  }

  //const sendSessionMessage = (io, data, next) => {
  //  const topic = CUSTOMER_CHANGED_TOPIC
  //  const room = `${data.model.id}:${topic}`
  //  io.sockets.in(room).emit(topic, { organization: data.organization_id })
  //  next()
  //}

  const sendEventMessage = (io, topic, data, next) => {
    const room = `${data.organization_id}:${topic}`
    logger.debug(`sending message to ${room}`)
    io.sockets.in(room).emit(topic, data)
    next()
  }

  return new Sockets()

}
