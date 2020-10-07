const fs = require('fs')
const logger = require('../logger')('config')
const loadConfig = () => {
  const env = process.env.NODE_ENV || 'default'
  try {
    return require(`./${env}`)
  } catch (err) {
    logger.error(err)
    logger.error('loading default configuration')
    return require('./default')
  }
}
module.exports = loadConfig ()
