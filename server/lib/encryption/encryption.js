const crypto = require('crypto')

class Encryption {
  constructor (specs) {
    this.algorithm = specs.algorithm
    // 16 bytes random string
    this.iv = specs.iv
    // 32 bytes random string
    this.secretKey = specs.secretKey
  }

  decrypt (text) {
    const decipher = crypto.createDecipheriv(this.algorithm, this.secretKey, this.iv)

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(text, 'hex')),
      decipher.final()
    ])

    return decrypted.toString()
  }

  encrypt (text) {
    const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, this.iv)

    const encrypted = Buffer.concat([ cipher.update(text), cipher.final() ])

    return encrypted.toString('hex')
  }
}

module.exports = Encryption
