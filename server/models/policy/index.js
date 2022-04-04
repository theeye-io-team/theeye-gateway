const mongoose = require('mongoose')

module.exports = function (db) {
  const schema = new mongoose.Schema({
    name: String,
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    customer_id: { type: mongoose.Schema.Types.ObjectId },
    grant: [{
      role: String,
      enrolled: [{ String }],
      description: String,
    }],
    creation_date: { type: Date, default: new Date() },
    last_update: { type: Date, default: new Date() },
  }, {
    collection: 'gw_policies',
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

  return db.model('Policy', schema)
}
