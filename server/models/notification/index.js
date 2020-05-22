const mongoose = require('mongoose')
const ObjectId = mongoose.Schema.Types.ObjectId

module.exports = function (db) {
  const schema = new mongoose.Schema({
    user_id: { type: ObjectId, required: true, index: true },
    user: { type: ObjectId, ref: 'User', required: true },
    customer_id: { type: ObjectId, required: true, index: true },
    customer: { type: ObjectId, ref: 'Customer', required: true },
    customer_name: { type: 'string' },
    topic: { type: 'string' },
    event_id: { type: 'string' },
    read: { type: 'boolean', default: false },
    data: { type: 'object', default: () => { return {} } },
    creation_date: { type: Date, default: () => { return new Date() }, required: true },
    last_update: { type: Date, default: () => { return new Date() }, required: true },
  }, {
    collection: 'gw_notification',
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

  return db.model('Notification', schema)
}
