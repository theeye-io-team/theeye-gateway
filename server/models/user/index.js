const mongoose = require('mongoose')

module.exports = function (db) {
  const User = db.model('User', new BaseSchema())
  const BotUser = User.discriminator('BotUser', new BaseSchema())
  const UiUser = User.discriminator('UiUser', new BaseSchema())
  return { User, BotUser, UiUser }
}

function BaseSchema () {
  const schema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    name: { type: 'string' },
    enabled: { type: 'boolean', default: false },
    credential: { type: 'string' }, // global property for internal use. will replace session credential when set
    invitation_token: { type: 'string', default: '' },
    devices: { type: 'array', default: [] },
    onboardingCompleted: { type: 'boolean', default: false },
    creation_date: { type: Date, default: () => { return new Date() }, required: true },
    last_update: { type: Date, default: () => { return new Date() }, required: true },
    last_login: { type: Date, default: new Date() }
  }, {
    collection: 'web_user',
    discriminatorKey: '_type'
  })

  const def = {
    getters: true,
    virtuals: true,
    transform: function (doc, ret, options) {
      // remove the _id of every document before returning the result
      ret.id = ret._id
      delete ret._id
      delete ret.__v
    }
  }

  schema.pre('save', function (next) {
    this.last_update = new Date()
    next(null)
  })

  schema.set('toJSON', def)
  schema.set('toObject', def)

  return schema
}
