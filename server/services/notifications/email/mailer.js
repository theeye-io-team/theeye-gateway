const nodemailer = require('nodemailer')

/** http://www.nodemailer.com/ **/
class Mailer {
  constructor (config) {
    const trType = config.transport.type
    const options = config.transport.options || {}
    let transport

    switch (trType) {
      case 'ses':
        transport = require('nodemailer-ses-transport')(options)
        break;
      case 'sendmail':
        transport = require('nodemailer-sendmail-transport')(options)
        break;
      case 'gmail':
        transport = {
          service: 'Gmail',
          auth: { user: options.user, pass: options.pass }
        };
        break;
      case 'smtp':
        transport = require('nodemailer-smtp-transport')(options)
        break;
      default:
        var msg = 'nodemailer transport ' + trType + ' not implemented.'
        throw new Error(msg)
        break
    }

    this.transporter = nodemailer.createTransport(transport)
  }

  sendMail (options, callback) {
    let from = config
      .from
      .replace(/%customer%/g, options.customer_name)

    options.from = from
    options.replyTo = config.reply_to

    if (
      config.only_support ||
      (!options.to && !options.bcc)
    ) {
      options.to = config.support.join(',')
    } else if (config.include_support_bcc) {
      options.bcc = config.support.join(',')
    }

    if (options.to) {
      options.to = options.to.toLowerCase()
    }

    if (options.bcc) {
      options.bcc = options.bcc.toLowerCase()
    }

    this.transporter.sendMail(options, callback)
  }
}

module.exports = Mailer
