const mongoose = require('mongoose')

module.exports = function () {
  const schema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    token: { type: String },
    expires: { type: Date, default: new Date() }
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

  return mongoose.model('Session', schema)
}
