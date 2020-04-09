const express = require('express')
const path = require('path')
const AuthRouter = require('./auth')
const SessionRouter = require('./session')
const NotificationRouter = require('./notification')
const InboxRouter = require('./inbox')
const MemberRouter = require('./member')
const BotRouter = require('./bot')
const MessageRouter = require('./message')
//const GatewayRouter = require('./gateway')

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
    api.get('/admin/*', staticRoute)

    const bearerMiddleware = app.service.authentication.middlewares.bearerPassport

    api.use('/api/auth', AuthRouter(app))
    api.use('/api/notification', NotificationRouter(app))
    api.use('/api/inbox', bearerMiddleware, InboxRouter(app))
    api.use('/api/session', bearerMiddleware, SessionRouter(app))
    api.use('/api/member', bearerMiddleware, MemberRouter(app))
    api.use('/api/bot', bearerMiddleware, BotRouter(app))
    api.use('/api/message', bearerMiddleware, MessageRouter(app))
    //api.use('/api', bearerMiddleware, GatewayRouter(app))
  }
}

module.exports = Router
