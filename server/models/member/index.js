const mongoose = require('mongoose')

module.exports = function (db) {
  const schema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    customer_id: { type: mongoose.Schema.Types.ObjectId },
    customer_name: { type: 'string' },
    credential: { type: 'string', default: 'viewer' },
    invitation_token: { type: 'string', default: null },
    creation_date: { type: Date, default: new Date(), required: true },
    last_update: { type: Date, default: new Date(), required: true },
    notifications: {
      type: 'object',
      default: () => {
        return {
          mute: false,
          push: true,
          email: true,
          desktop: true
        }
      }
    }
  }, {
    collection: 'members',
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

  return db.model('Member', schema)
}
