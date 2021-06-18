const fs = require('fs')
const path = require('path')
const logger = require('../logger')('config')
const Encryption = require('../lib/encryption')


const loadConfig = () => {
  const env = process.env.NODE_ENV || 'default'

  if (process.env.THEEYE_CONFIG_ENCRYPTED === "true") {
    logger.log('reading encrypted configuration file')

    let filename = process.env.THEEYE_CONFIG_ENCRYPTED_FILENAME
    if (!filename) {
      filename = path.join(__dirname,`${env}.json.enc`)
    }

    return JSON.parse( Encryption('decrypt', filename) )
  } else {
    try {

      return require(`./${env}`)

    } catch (err) {

      logger.error(err)
      logger.error('loading default configuration')

      return require('./default')
    }
  }
}

module.exports = loadConfig
