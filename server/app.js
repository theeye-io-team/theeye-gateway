const express = require('express')
const path = require('path')
const http = require('http')
const https = require('https')
const socket = require('socket.io')
const router = require('./router')
const Models = require('./models')

const logger = require('./logger')('app')
const Tokens = require('./services/tokens')
const Notifications = require('./services/notifications')

const AuthenticationMiddleware = require('./middleware/authentication')

const aws = require('aws-sdk')

//const cookieParser = require('cookie-parser')

class App {
  constructor () {
  }

  async configure (config) {
    this.config = config

    this.api = setupApi()

    // services
    this.service = {}
    this.service.tokens = new Tokens(this)
    this.service.notifications = new Notifications(this)
    this.service.sns = setupSNS(this)

    this.models = new Models(this)
    await this.models.configure()

    // routes require models
    setupRoutes(this, config)
  }

  start () {
    const port = this.config.app.port
    this.api.listen(port, () => {
      logger.log(`API ready at port ${port}`)
    })
  }
}

module.exports = App

// must be function to scope app
const setupApi = () => {
  let api = express()
  //const server = process.env.NODE_ENV === 'development' ? http.Server(api) : https.Server(api)

  api.use(express.json())
  api.use(express.urlencoded({ extended: true }))
  //api.use(cookieParser())

  return api
}

const setupAuth = (app) => {
  return 
}

const setupSNS = (app) => {
  return new aws.SNS(new aws.Config(app.config.services.aws))
}

const setupRoutes = (app, config) => {

  // authentication require models
  new AuthenticationMiddleware(app)

  let api = app.api
  api.use(express.static(path.join(__dirname, '../client/dist')))
  router.route(api)

  // last route 404
  api.use((req, res, next) => {
    let payload = { message: `${req.path} not found`, status: 404 }
    logger.log(payload)
    res.status(payload.status)
    res.json(payload)
  })
}
