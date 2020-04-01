const mongoose = require('mongoose')

module.exports = function (db) {
  const schema = new mongoose.Schema({
    //customer_id: { type: 'string' },
    customer_name: { type: 'string', required: true, index: true },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: 'User'
    },
    topic: { type: 'string' },
    event_id: { type: 'string' },
    read: { type: 'boolean', default: false },
    data: { type: 'object', default: () => { return {} } }
  }, {
    collection: 'web_notification',
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

  return db.model('Notification', schema)
}
