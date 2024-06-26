const { Server } = require('socket.io')
const { createAdapter } = require("@socket.io/redis-adapter")
const { createClient } = require('redis')
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

    async start () {
      const io = this.io = new Server(app.server, {
        cors: {
          origin: "*",
          credentials: true
        }
      })

      const pubClient = createClient(app.config.redis)
      const subClient = pubClient.duplicate()

      pubClient.on('error', (err) => {
        console.log('redis pub client error', err)
      })
      subClient.on('error', (err) => {
        console.log('redis sub client error', err)
      })

      await pubClient.connect()
      await subClient.connect()

      io.adapter(createAdapter(pubClient, subClient))

      io.on('connection', (socket) => {
        logger.log('user connected')
        SocketHandler(socket)
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
    socket.onAny((eventName, ...args) => {
      logger.debug('socket event receive %s, %o', eventName, args[0])
    })

    for (let eventName in SocketEvents) {
      if (eventName === 'post:authorize') {
        socket.on('post:authorize', (params, next) => {
          // @TODO use socket.request as request.
          SocketEvents['post:authorize']({ socket, params }, next)
        })
      } else {
        socket.on(
          eventName,
          middlewares(socket, eventName, SocketEvents[eventName])
        )
      }
    }

    return this
  }

  const SocketEvents = {
    'post:authorize': (req, next) => {
      const { socket, params } = req
      tokenVerify(socket, (err, user, session) => {
        if (err) {
          logger.error(err.message)
          next({ status: 401, message: err.message })
          socket.disconnect()
        } else {
          const session_id = session._id.toString()
          const user_id = session.user_id.toString()
          const customer_id = session.customer_id.toString()

          // user session subscriptions
          joinRoom(socket, `${customer_id}:${user_id}:${TopicConstants.NOTIFICATION_CRUD}`)
          joinRoom(socket, `${session_id}:${user_id}:${TopicConstants.SESSION}`)

          logger.log('authorized')
          req.socket.authorized = true
          next({ status: 200, message: 'authorized' })
        }
      })
    },
    'disconnect': (req, next) => {
      logger.log('client disconnected')
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
        TopicConstants.WORKFLOW_JOB_CRUD,
        TopicConstants.SCHEDULE_CRUD,
        TopicConstants.INDICATOR_CRUD,
        TopicConstants.HOST_INTEGRATIONS_CRUD,
        TopicConstants.MESSAGE_CRUD,
      ]

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

    if (socket.handshake.auth && socket.handshake.auth.access_token) {
      let token = socket.handshake.auth.access_token
      app.service.authentication.verifySessionToken(
        socket.request, // IncommingMessage
        token,
        (err, user, session) => {
          if (err) {
            logger.error(err)
            unauthorized()
          } else {
            next(null, user, session)
          }
        }
      )
    } else {
      disconnect()
    }
  }

  const middlewares = (socket, eventName, handler) => {
    return (params, next) => {
      next || (next=()=>{})

      if (!socket.authorized) {
        logger.log('unauthorized')
        return next({
          status: 401,
          message: 'Incompleted authorization handshake'
        })
      }

      if (eventName === 'disconnect') {
          // @TODO use socket.request as request.
        handler({socket}, next)
      } else {
        logger.log('authentication middleware')
        tokenVerify(socket, (err, user, session) => {
          if (err) {
            logger.error(err.message)
            next({ status: 401, message: err.message })
          } else {
          // @TODO use socket.request as request.
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
