const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

module.exports = function (db) {
  const schema = new mongoose.Schema({
    // Required field: Protocol
    //
    // Defines the protocol to use for the passport. When employing the local
    // strategy, the protocol will be set to 'local'. When using a third-party
    // strategy, the protocol will be set to the standard used by the third-
    // party service (e.g. 'oauth', 'oauth2', 'openid').
    protocol: { type: 'string', required: true },
    // Local field: Password
    //
    // When the local strategy is employed, a password will be used as the
    // means of authentication along with either a username or an email.
    password: { type: 'string' },
    // Provider fields: Provider, identifer and tokens
    //
    // "provider" is the name of the third-party auth service in all lowercase
    // (e.g. 'github', 'facebook') whereas "identifier" is a provider-specific
    // key, typically an ID. These two fields are used as the main means of
    // identifying a passport and tying it to a local user.
    //
    // The "tokens" field is a JSON object used in the case of the OAuth stan-
    // dards. When using OAuth 1.0, a `token` as well as a `tokenSecret` will
    // be issued by the provider. In the case of OAuth 2.0, an `accessToken`
    // and a `refreshToken` will be issued.
    provider: { type: 'string' },
    identifier: { type: 'string' },
    tokens: { type: 'object' },
    // Associations
    //
    // Associate every passport with one, and only one, user. This requires an
    // adapter compatible with associations.
    //
    // For more information on associations in Waterline, check out:
    // https://github.com/balderdashy/waterline
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    creation_date: { type: Date, default: () => { return new Date() }, required: true },
    last_update: { type: Date, default: () => { return new Date() }, required: true },
    last_access: { type: Date }
  }, {
    collection: 'gw_passport',
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

  schema.pre('save', function (next) {
    if (!this.isNew) { return next() } // on update
    if (!this.password) { return next() }
    bcrypt.hash(this.password, 10, (err, hash) => {
      if (err) { next(err) }
      else {
        this.password = hash
        next()
      }
    })
  })

  //schema.pre('update', function (next) {
  //  const password = this.getUpdate().$set.password
  //  if (!password) { return next() }
  //  bcrypt.hash(this.password, 10, (err, hash) => {
  //    if (err) { next(err) }
  //    else {
  //      this.getUpdate().$set.password = hash
  //      next()
  //    }
  //  })
  //})

  schema.methods.validatePassword = function (password) {
    return new Promise( (resolve, reject) => {
      bcrypt.compare(password, this.password, (err, valid) => {
        if (valid === true) { resolve(true) }
        else { reject(new Error('InvalidPassword')) }
      })
    })
  }

  return db.model('Passport', schema)
}
