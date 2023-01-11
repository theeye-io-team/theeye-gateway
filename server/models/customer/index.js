const mongoose = require('mongoose')
const apiFetch = require('../api-fetch')

module.exports = function (db) {
  const schema = new mongoose.Schema({
    disabled: { type: Boolean },
    name: {
      type: String,
      index: true,
      unique: true,
      required: true,
      dropDups: true
    },
    alias: {
      type: String,
      index: true,
      unique: true,
      required: false
    },
    display_name: { type: String },
    description: { type: String, default: '' },
    owner_id: { type: mongoose.Schema.Types.ObjectId },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    config: {
      type: Object,
      default: () => {
        return { }
      }
    },
    creation_date: { type: Date, default: () => { return new Date() } },
    last_update: { type: Date, default: () => { return new Date() } },
  }, {
    collection: 'customers',
    discriminatorKey: '_type'
  })

  const def = {
    getters: true,
    virtuals: true,
    transform (doc, ret, options) {
      ret.id = ret._id.toHexString()
      delete ret._id
      delete ret.__v
    }
  }

  schema.pre('save', function (next) {
    this.last_update = new Date()
    // do stuff
    next()
  })

  schema.set('toJSON', def)
  schema.set('toObject', def)

  schema.statics.apiFetch = apiFetch

  return db.model('Customer', schema)
}
