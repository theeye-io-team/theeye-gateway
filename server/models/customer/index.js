const mongoose = require('mongoose')

module.exports = function (db) {
  const schema = new mongoose.Schema({
    name: {
      type: String,
      index: true,
      unique: true,
      required: true,
      dropDups: true
    },
    description: { type: String, default: '' },
    owner_id: { type: mongoose.Schema.Types.ObjectId },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    config: {
      type: Object,
      default: () => {
        return {
          monitor: {},
          kibana: null,
          elasticsearch: {
            enabled: false,
            url: ''
          },
          ngrok: {
            enabled: false,
            authtoken: '',
            address: '',
            protocol: ''
          }
        }
      }
    },
    creation_date: { type: Date, default: new Date() },
    last_update: { type: Date, default: new Date() },
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

  return db.model('Customer', schema)
}
