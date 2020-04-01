const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

module.exports = function (db) {
  const schema = new mongoose.Schema({
    protocol: { type: 'alphanumeric', required: true },
    password: { type: 'string' },
    provider: { type: 'string' },
    identifier: { type: 'string' },
    tokens: { type: 'object' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, required: true },
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
    hashPassword(passport, next)
  })

  const hashPassword = (passport, next) => {
    if (passport.password) {
      bcrypt.hash(passport.password, 10, (err, hash) => {
        passport.password = hash
        next(err, passport)
      })
    } else {
      next(null, passport)
    }
  }

  schema.validatePassword = (password, next) => {
    bcrypt.compare(password, this.password, next)
  }

  return db.model('Passport', schema)
}
