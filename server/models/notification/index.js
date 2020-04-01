const mongoose = require('mongoose')

module.exports = function () {
  const schema = new mongoose.Schema({
    //customer_id: { type: 'string' },
    customer_name: { type: 'string', required: true, index: true },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: 'AppUser'
    },
    topic: { type: 'string' },
    event_id: { type: 'string' },
    read: { type: 'boolean', default: false },
    data: { type: 'object', default: () => { return {} } }
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

  return mongoose.model('AppNotification', schema)
}
