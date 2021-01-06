const socketIO = require('socket.io')
const socketIOredis = require('socket.io-redis')
const logger = require('../../../logger')(':services:notifications:sockets')
const TopicConstants = require('../../../constants/topics')
const AbstractNotification = require('../abstract')
const Emitter = require('./emitter')

module.exports = function (app, config) {
  class Sockets extends AbstractNotification {
    constructor () {
      super()

      this.io
      this.emitter = new Emitter()
    }

    start (server) {
      const io = this.io = socketIO.listen(server)
      io.adapter(socketIOredis(app.config.redis))
      io.sockets.on('connection', function onConnection (socket) {
        logger.log('user connected')
        let handler = new SocketHandler(socket)
      })
    }

    sendEvent (event, user) {
      try {
        this.emitter.emit(this.io, event, user)
      } catch (err) {
        logger.error(err)
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
        TopicConstants.SCHEDULE_CRUD,
        TopicConstants.INDICATOR_CRUD,
        TopicConstants.HOST_INTEGRATIONS_CRUD,
        TopicConstants.MESSAGE_CRUD,
      ]

      // user session subscriptions
      joinRoom(socket, `${customer_id}:${user_id}:${TopicConstants.NOTIFICATION_CRUD}`)
      joinRoom(socket, `${customer_id}:${user_id}:${TopicConstants.JOB_RESULT_RENDER}`)
      joinRoom(socket, `${session_id}:${user_id}:${TopicConstants.SESSION}`)

      if (app.service.authentication.acl.hasFullaccess(session.credential)) {
        // subscribe to all admin rooms
        topics.forEach(topic => joinRoom(socket, `${customer_id}:admin:${topic}`))
      } else {
        // member with reduced access exclusive rooms 
        topics.forEach(topic => joinRoom(socket, `${customer_id}:${user_id}:${topic}`))
      }

      next({ status: 200, body: { message: 'auto-subscription success' } })
    },
    'post:subscribe': (req, next) => {
      const socket = req.socket
      const session = req.session
      const customer_id = session.customer_id.toString()
      const topics = req.params.topics
      const user_id = session.user_id.toString()

      if (!Array.isArray(topics) || topics.length === 0) {
        return next({ status: 400, body: { message: 'nothing to subscribe' } })
      }

      if (!topics.every(topic => Object.values(TopicConstants).indexOf(topic) !== -1) ) {
        return next({ status: 400, body: { message: 'invalid topics' } })
      }

      if (app.service.authentication.acl.hasFullaccess(session.credential)) {
        // subscribe to all admin rooms
        topics.forEach(topic => joinRoom(socket, `${customer_id}:admin:${topic}`))
      } else {
        // member with reduced access exclusive rooms 
        topics.forEach(topic => joinRoom(socket, `${customer_id}:${user_id}:${topic}`))
      }

      next({ status: 200, body: { message: 'subscription success' } })
    },
    'post:unsubscribe': (req, next) => {
      const session = req.session
      const customer_id = session.customer_id.toString()
      const socket = req.socket
      const user_id = session.user_id.toString()

      let topics = req.params.topics

      if (!topics) { // unsubscribe all
        for (let room in socket.rooms) {
          let msg = `member leaving room ${room}`
          logger.debug(msg)
          socket.leave(room)
        }
      } else {
        if (app.service.authentication.acl.hasFullaccess(session.credential)) {
          // leave all admin rooms
          topics.forEach(topic => socket.leave(`${customer_id}:admin:${topic}`))
        } else {
          // leave member exclusive rooms 
          topics.forEach(topic => socket.leave(`${customer_id}:${user_id}:${topic}`))
        }
      }

      next({ status: 200 })
    },
    'get:subscriptions': (req, next) => {
      const socket = req.socket
      next({ status: 200, body: Object.keys(socket.rooms) })
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

  const joinRoom = (socket, room) => {
    socket.join(room)
    logger.debug('member subscribed to %s', room)
  }

  return new Sockets()
}
