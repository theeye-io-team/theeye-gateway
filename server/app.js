const express = require('express')
const path = require('path')
const http = require('http')
const https = require('https')
const socket = require('socket.io')
const router = require('./router')
const Models = require('./models')

const logger = require('./services/logger')('app')
const Tokens = require('./services/tokens')
const Authentication = require('./services/authentication')
const Notifications = require('./services/notifications')

const aws = require('aws-sdk')

//const cookieParser = require('cookie-parser')

const app = {
  async configure (config) {
    this.config = config

    this.api = setupApi()

    // services
    this.tokens = setupTokens(config)
    this.sns = setupSNS(config)
    this.notifications = setupNotifications(config)

    this.models = await setupModels(config)

    // authentication require models
    setupAuth(this)
    // routes require models
    setupRoutes(this, config)
  },

  start () {
    const port = this.config.app.port
    this.api.listen(port, () => {
      logger.log(`API ready at port ${port}`)
    })
  }
}

module.exports = app

const setupApi = () => {
  let api = express()
  //const server = process.env.NODE_ENV === 'development' ? http.Server(api) : https.Server(api)

  api.use(express.json())
  api.use(express.urlencoded({ extended: true }))
  //api.use(cookieParser())

  return api
}

const setupAuth = (app) => {
  return new Authentication(app, app.config.services.authentication)
}

const setupTokens = (config) => {
  return new Tokens(config.services.tokens)
}

const setupSNS = (config) => {
  return new aws.SNS(new aws.Config(config.services.aws))
}

const setupNotifications = (config) => {
  return new Notifications(config.services.notifications)
}

const setupModels = async (config) => {
  let models = new Models(config)
  await models.configure()
  return models
}

const setupRoutes = (app, config) => {
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

