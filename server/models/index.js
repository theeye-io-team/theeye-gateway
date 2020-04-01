//const user = require('./user')
const MongodbDS = require('./mongodb')
const NotificationModel = require('./notification')
const UserModel = require('./user')

class Models {
  constructor (config) {
    this.config = config.models
    this.datasource = new MongodbDS(config.mongodb)
  }

  async configure () {
    await this.datasource.connect()

    this.user = new UserModel()
    this.notification = new NotificationModel()
  }
}

module.exports = Models
