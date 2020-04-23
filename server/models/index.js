//const user = require('./user')
const MongodbDS = require('./mongodb')
const NotificationModel = require('./notification')
const PassportModel = require('./passport')
const SessionModel = require('./session')
const UserModel = require('./user')
const CustomerModel = require('./customer')
const MemberModel = require('./member')

class Models {
  constructor (app) {
    this.config = app.config.models
    this.datasource = new MongodbDS(app.config.mongodb)
  }

  async configure () {
    let db = await this.datasource.connect()

    this.notification = new NotificationModel(db)
    this.passport = new PassportModel(db)
    this.session = new SessionModel(db)
    this.customer = new CustomerModel(db)
    this.member = new MemberModel(db)

    const users = new UserModel(db)
    this.users = {
      user: users.User,
      uiUser: users.UiUser,
      botUser: users.BotUser
    }
  }
}

module.exports = Models
