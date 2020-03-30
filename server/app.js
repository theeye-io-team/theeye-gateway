const express = require('express')
const path = require('path')
const http = require('http')
const https = require('https')
const socket = require('socket.io')
const router = require('./router')
const config = require('./config')

const Notifications = require('./services/notifications')

const aws = require('aws-sdk')

//const cookieParser = require('cookie-parser')

class App {
  constructor () {
  }

  initialize () {
    const app = express()
    app.config = config
    const server = process.env.NODE_ENV === 'development' ? http.Server(app) : https.Server(app)
    const port = config.application.port
    const io = (server)

    app.use(express.static(path.join(__dirname, '../client/dist')))

    router.route(app)

    //app.use(cookieParser())
    app.use(express.json())
    app.use(express.urlencoded({ extended: false }))

    app.listen(port, () => console.log(`api ready`))

    this.setupSNS(config)
    this.setupNotifications(config)
  }

  setupSNS (config) {
    this.sns = new aws.SNS(new aws.Config(config.aws))
  }

  setupNotifications (config) {
    this.notifications = new Notifications(config.services.notifications)
  }
}

module.exports = App
