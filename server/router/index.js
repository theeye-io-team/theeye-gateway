const express = require('express')
const path = require('path')
const AuthRouter = require('./auth')
const SessionRouter = require('./session')
const NotificationRouter = require('./notification')
const SocketsRouter = require('./sockets')

class Router {
  constructor (app) {
    this.app = app
    let api = app.api

    // static api route
    api.get('/login', (req, res) => {
      res.sendFile(path.join(__dirname, '../../client/dist/index.html'))
    })

    api.use('/api/auth', AuthRouter(app))
    api.use('/api/session', SessionRouter(app))
    api.use('/api/notification', NotificationRouter(app))
    api.use('/api/socket', SocketsRouter(app))
  }
}

module.exports = Router
