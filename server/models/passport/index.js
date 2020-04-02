const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

module.exports = function (db) {
  const schema = new mongoose.Schema({
    protocol: { type: 'string', required: true },
    password: { type: 'string' },
    provider: { type: 'string' },
    identifier: { type: 'string' },
    tokens: { type: 'object' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    creation_date: { type: Date, default: new Date(), required: true },
    last_update: { type: Date, default: new Date(), required: true },
  }, {
    collection: 'web_passport',
    discriminatorKey: '_type'                                        
  })


  /**
   * Hash a passport password.
   *
   * @param {Object}   password
   * @param {Function} next
   */

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

  schema.pre('save', next => {
    this.last_update = new Date()
    let passport = this
    if (passport.password) {
      bcrypt.hash(passport.password, 10, (err, hash) => {
        passport.password = hash
        next(err)
      })
    } else {
      next(null)
    }
  })

  schema.validatePassword = (password, next) => {
    bcrypt.compare(password, this.password, next)
  }

  return db.model('Passport', schema)
}
