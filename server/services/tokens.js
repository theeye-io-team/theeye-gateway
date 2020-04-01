/**
 * jwToken
 *
 * @description :: JSON Webtoken Service
 */
 
const jwt = require('jsonwebtoken')

class Tokens {
  constructor (config) {
    this.config = config
  }

  /**
   *
   * @return {String} token
   *
   */
  issue (payload, options = {}) {
    return jwt.sign(
      payload,
      this.config.secret, // our Private Key
      {
        expiresIn: options.expiresIn || this.config.expires
      }
    )
  }

  /**
   *
   * for more option see https://github.com/auth0/node-jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback
   *
   * @return {Object} decoded token
   * @throws
   *
   */
  verify (payload) {
    let decoded = jwt.verify(
      token,
      this.config.secret,
      {}
    )

    return decoded
  }
}
module.exports = Tokens
