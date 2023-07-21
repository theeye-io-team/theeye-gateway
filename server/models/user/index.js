const mongoose = require('mongoose')
const apiFetch = require('../api-fetch')

module.exports = function (db) {

  const User = db.model('User', new BaseSchema({
    current_customer_id: {
      "type": mongoose.Schema.Types.ObjectId,
      "default": null,
      "required": false
    }
  }))

  const BotUser = User.discriminator('BotUser', new BaseSchema())
  const UiUser = User.discriminator('UiUser', new BaseSchema())

  return { User, BotUser, UiUser }
}

function BaseSchema (extraProps = {}) {
  const schema = new mongoose.Schema(
    Object.assign({}, extraProps, {
      username: { type: String, unique: true, required: true },
      email: { type: String, unique: true, required: true },
      email_verified: { type: Boolean, default: false },
      extra_emails: [{ type: String }],
      name: { type: 'string' },
      enabled: { type: 'boolean', default: false },
      credential: { type: 'string' }, // global property for internal use. will replace session credential when set
      invitation_token: { type: 'string', default: '' },
      security_token: { type: 'string', default: '' }, // user actions request
      devices: { type: 'array', default: [] },
      onboardingCompleted: { type: 'boolean', default: false },
      creation_date: { type: Date, default: () => { return new Date() }, required: true },
      last_update: { type: Date, default: () => { return new Date() } },
      last_access: { type: Date },
      tags: [{ type: Object }]
    }), {
      collection: 'gw_user',
      discriminatorKey: '_type'
    }
  )

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

  schema.statics.apiFetch = apiFetch

  return schema
}
