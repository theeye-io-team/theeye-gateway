const express = require('express')
const path = require('path')
const AuthRouter = require('./auth')
const SessionRouter = require('./session')
const NotificationRouter = require('./notification')
const SocketsRouter = require('./sockets')

module.exports = (app) => {
  app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'))
  })

  app.use('/api/auth', AuthRouter)
  app.use('/api/session', SessionRouter)
  app.use('/api/notification', NotificationRouter)
  app.use('/api/socket', SocketsRouter)
}
