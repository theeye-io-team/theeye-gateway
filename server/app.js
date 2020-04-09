const express = require('express')
const path = require('path')
const http = require('http')
const https = require('https')
const Router = require('./router')
const Models = require('./models')

const logger = require('./logger')('app')
const Authentication = require('./services/authentication')
const Notifications = require('./services/notifications')

const aws = require('aws-sdk')

class App {
  constructor () { }

  async configure (config) {
    this.config = config

    // services
    this.service = {}
    this.service.authentication = new Authentication(this)
    this.service.notifications = new Notifications(this)
    this.service.sns = setupSNS(this)

    this.models = new Models(this)
    await this.models.configure()

    // routes require models
    this.setupApi()
  }

  start () {
    const port = this.config.app.port
    const server = this.server = this.api.listen(port, () => {
      logger.log(`API ready at port ${port}`)
    })

    this.service.notifications.sockets.start(server)
  }

  setupApi () {

    let api = this.api = express()
    //const server = process.env.NODE_ENV === 'development' ? http.Server(api) : https.Server(api)

    api.use(express.json())
    api.use(express.urlencoded({ extended: true }))

    // authentication require models
    //this.service.authentication.middleware()

    api.use(express.static(path.join(__dirname, '../client/dist')))
    new Router(this)

    // last route 404
    api.use((req, res, next) => {
      let payload = { message: `${req.path} not found`, status: 404 }
      logger.log(payload)
      res.status(payload.status)
      res.json(payload)
    })

    api.use((err, req, res, next) => {
      let statusCode = err.status||err.statusCode
      if (isClientError(statusCode) === true) {
        logger.log(err.stack)
        res.status(statusCode).json({ message: err.message })
      } else if (isServerError(statusCode)) {
        logger.error(err.stack)
        res.status(statusCode).json({ message: 'internal error' })
      } else {
        logger.error(err.stack)
        res.status(500).json({ message: 'internal error' })
      }
    })

    return api
  }
}

module.exports = App

const isClientError = (statusCode) => {
  return statusCode && statusCode >= 400 && statusCode < 500
}

const isServerError = (statusCode) => {
  return statusCode && statusCode >= 500
}

const setupAuth = (app) => {
  return 
}

const setupSNS = (app) => {
  return new aws.SNS(new aws.Config(app.config.services.aws))
}
