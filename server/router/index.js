const express = require('express')
const path = require('path')
const AuthRouter = require('./auth')
const SessionRouter = require('./session')
const NotificationRouter = require('./notification')
const InboxRouter = require('./inbox')
const MemberRouter = require('./member')
const BotRouter = require('./bot')
const TokenRouter = require('./token')
const MessageRouter = require('./message')
const CustomerRouter = require('./customer')
const UserRouter = require('./user')
const RegistrationRouter = require('./registration')
const logger = require('../logger')('router')
const CompatibilityRouter = require('./compatibility')

const GatewayRouter = require('./gateway')

class Router {
  constructor (app) {
    this.app = app
    let api = app.api

    // static api route
    const staticRoute = (req, res) => {
      res.sendFile(path.join(__dirname, '../../client/dist/index.html'))
    }
    api.get('/login', staticRoute)
    api.get('/logout', staticRoute)
    api.get('/dashboard', staticRoute)
    api.get('/activate', staticRoute)
    api.get('/admin/*', staticRoute)

    const bearerMiddleware = app.service.authentication.middlewares.bearerPassport

    api.use((req, res, next) => {
      if (/api./.test(req.url)) {
        logger.log('INCOMMING API REQUEST %s %s', req.method, req.url)
      }
      next()
    })

    api.use('/api/auth', AuthRouter(app))
    api.use('/api/notification', NotificationRouter(app))
    api.use('/api/inbox', bearerMiddleware, InboxRouter(app))
    api.use('/api/session', bearerMiddleware, SessionRouter(app))
    api.use('/api/member', bearerMiddleware, MemberRouter(app))
    api.use('/api/bot', bearerMiddleware, BotRouter(app))
    api.use('/api/token', bearerMiddleware, TokenRouter(app))
    api.use('/api/message', bearerMiddleware, MessageRouter(app))
    api.use('/api/customer', bearerMiddleware, CustomerRouter(app))
    api.use('/api/user', bearerMiddleware, UserRouter(app))
    api.use('/api/registration', RegistrationRouter(app))

    // compatibilityRoutes
    api.use('/apiv2', bearerMiddleware, GatewayRouter(app))
    api.use('/apiv3', bearerMiddleware, GatewayRouter(app))
    api.use('/', CompatibilityRouter(app))

  }
}

module.exports = Router
