const express = require('express')
const path = require('path')
const AuthRouter = require('./auth')
const SessionRouter = require('./session')
const NotificationRouter = require('./notification')
const InboxRouter = require('./inbox')
//const MemberRouter = require('./member')
const SocketsRouter = require('./sockets')

const passport = require('passport')

class Router {
  constructor (app) {
    this.app = app
    let api = app.api

    // static api route
    const staticRoute = (req, res) => {
      res.sendFile(path.join(__dirname, '../../client/dist/index.html'))
    } 
    api.get('/login', staticRoute)
    api.get('/dashboard', staticRoute)

    const bearerMiddleware = (req, res, next) => {
      passport.authenticate('bearer', (err, user, session) => {
        if (err) {
          if (err.status >= 400) {
            res.status(err.status)
            return res.json(err.message)
          }
          next(err)
        } else {
          req.session = session
          req.user = user
          next()
        }
      }, {session: false})(req, res, next)
    }

    api.use('/api/auth', AuthRouter(app))
    api.use('/api/notification', NotificationRouter(app))
    api.use('/api/inbox', bearerMiddleware, InboxRouter(app))
    api.use('/api/session', bearerMiddleware, SessionRouter(app))
    //api.use('/api/member', bearerMiddleware, MemberRouter(app))
    //api.use('/api/socket', SocketsRouter(app))
  }
}

module.exports = Router
