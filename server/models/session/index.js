const mongoose = require('mongoose')

module.exports = function (db) {
  const schema = new mongoose.Schema({
    token: { type: String, required: true },
    expires: { type: Date },
    creation_date: { type: Date, default: () => { return new Date() }, required: true },
    last_update: { type: Date, default: () => { return new Date() }, required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    member_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    customer_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    credential: { type: String, required: true }
  }, {
    collection: 'web_session',
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

  schema.set('toJSON', def)
  schema.set('toObject', def)

  schema.pre('save', function (next) {
    this.last_update = new Date()
    next(null)
  })

  return db.model('Session', schema)
}
