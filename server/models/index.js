//const user = require('./user')
const MongodbDS = require('./mongodb')
const NotificationModel = require('./notification')
const UserModel = require('./user')
const PassportModel = require('./passport')

class Models {
  constructor (app) {
    this.config = app.config.models
    this.datasource = new MongodbDS(app.config.mongodb)
  }

  async configure () {
    let db = await this.datasource.connect()

    this.user = new UserModel(db)
    this.passport = new PassportModel(db)
    this.notification = new NotificationModel(db)
  }
}

module.exports = Models
