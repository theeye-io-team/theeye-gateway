const nodemailer = require('nodemailer')
const logger = require('../../../logger')('services:notifications:email:mailer')

/**
 *
 * http://www.nodemailer.com/
 *
 */
class Mailer {
  constructor (config) {
    this.config = config

    const options = (config.transport.options || {})
    const transportType = config.transport.type

    if (!Object.prototype.hasOwnProperty.call(TransportMap, transportType)) {
      throw new Error('mail service exception. invalid type ' + transportType)
    }

    logger.log(`creating transport ${transportType} with options %o`, options)

    const transport = TransportMap[transportType](options)
    this.transporter = nodemailer.createTransport(transport)
  }

  /**
   *
   * @param {Object} options
   * @property {String} options.to
   * @property {String} options.bcc
   * @property {String} options.subject
   * @property {String} options.body
   *
   */
  sendMail (options, callback) {
    options.replyTo = this.config.reply_to

    if (
      this.config.only_support ||
      (!options.to && !options.bcc)
    ) {
      options.to = this.config.support.join(',')
    } else if (this.config.include_support_bcc) {
      options.bcc = this.config.support.join(',')
    }

    if (options.to) {
      options.to = options.to.toLowerCase()
    }

    if (options.bcc) {
      options.bcc = options.bcc.toLowerCase()
    }

    logger.debug(options)
    this.transporter.sendMail(options, callback)
  }
}

module.exports = Mailer

const TransportMap = {}
TransportMap['ses'] = (options) => {
  return require('nodemailer-ses-transport')(options)
}
TransportMap['sendmail'] = (options) => {
  return require('nodemailer-sendmail-transport')(options)
}
TransportMap['smtp'] = (options) => {
  return require('nodemailer-smtp-transport')(options)
}
TransportMap['gmail'] = (options) => {
  const settings = {
    service: 'Gmail',
    auth: {
      user: options.user,
      pass: options.pass
    }
  }
  logger.log(settings)
  return settings
}
