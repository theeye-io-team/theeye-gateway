const Mailer = require('./mailer')
const logger = require('../../../logger')('services:notifications:email')
const TopicsConstants = require('../../../constants/topics')

class Email {
  constructor (app, config) {
    this.config = config
    this.mailer = new Mailer(config)
  }

  async sendEvent (event, user) {
    if (!isHandledEvent(event)) {
      logger.log(`topic dismiss. not handled`)
      // ignore
      return
    }

    if (!user.email) {
      throw new Error(`${user._id} address not set`)
    }

    if (!event.data.subject || !event.data.body) {
      logger.data(event)
      throw new Error(`missing subject and body`)
    }

    let message = {
      body: event.data.body,
      subject: event.data.subject
    }

    return this.send(message, user.email)
  }

  send (message, address) {
    return new Promise((resolve, reject) => {
      let mail = {}
      mail.bcc = message.address || address
      mail.html = message.body || message.html
      mail.subject = message.subject

      this.mailer.sendMail(mail, (err, response) => {
        if (err) reject(err)
        else {
          logger.log(response)
          resolve()
        }
      })
    })
  }
}

const isHandledEvent = (event) => {
  // HANDLE
  // monitor state changes
  let verify = (event.topic === TopicsConstants.MONITOR_STATE)
  return verify
}

module.exports = Email
  //sendUserActivatedEMail: function (input, next) {
  //  var data = { locals: input };
  //  ejs.renderFile("views/email/activated.ejs", data, function(error, html) {
  //    if(error) {
  //      logger.error('Error parsing "views/email/activated.ejs"');
  //      logger.error(error);
  //      return next(error);
  //    }

  //    var options = {
  //      to: input.invitee.email,
  //      subject: 'TheEye Invitation',
  //      html: html
  //    };

  //    mailer.sendMail(options, function(error, info) {
  //      if(error) logger.error("Error sending email to " + input.invitee.email);
  //      else logger.debug('Message sent');
  //      return next(error);
  //    });
  //  });
  //},
  //sendRegistrationMail: function (input, next) {
  //  var data = { locals: input };
  //  ejs.renderFile("views/email/registration.ejs", data, function(error, html) {
  //    if(error) {
  //      logger.error('Error parsing "views/email/registration.ejs"');
  //      logger.error(error);
  //      return next(error);
  //    }

  //    var options = {
  //      to: input.invitee.email,
  //      subject: 'Confirma tu registro en TheEye',
  //      html: html
  //    };

  //    mailer.sendMail(options, function(error, info) {
  //      if(error) logger.error("Error sending email to " + input.invitee.email);
  //      else logger.debug('Message sent');
  //      return next(error);
  //    });
  //  });
  //},
  //sendPasswordRecoveryEMail: function(data, next) {
  //  ejs.renderFile("views/email/retrive-password.ejs", {
  //    locals: data
  //  }, function (error, html) {
  //    var options = {
  //      to: data.user.email,
  //      subject: 'TheEye Password Restore',
  //      html: html
  //    };

  //    mailer.sendMail(options, function(error, info) {
  //      if(error) logger.error("Error sending email to " + email);
  //      else logger.debug('Message sent');
  //      return next(error);
  //    });
  //  });
  //},
  //sendContactMail (email, data, next) {
  //  ejs.renderFile("views/email/contact.ejs", { locals: data }, function(error, html) {
  //    var options = {
  //      to: config.invitation,
  //      subject: 'TheEye Contact',
  //      html: html
  //    };

  //    logger.debug('sending contact notification email...');
  //    mailer.sendMail(options, function(error, info) {
  //      if (error) {
  //        return next(error);
  //      } else {
  //        logger.debug('Contact message sent');
  //        ejs.renderFile("views/email/contact-confirmation.ejs", { locals: data }, function(error, html) {
  //          var options = {
  //            to: email,
  //            subject: 'TheEye Contact',
  //            html: html
  //          };

  //          mailer.sendMail(options, function(error, info) {
  //            if (error) {
  //              logger.error("Error sending email to " + email);
  //            }
  //            return next(error);
  //          });
  //        });
  //      }
  //    });
  //  });
  //},
  //sendCustomerPermissionsChanged: function(user, next) {
  //  ejs.renderFile("views/email/customer-permissions.ejs", {locals: user}, function(error, html) {
  //    var options = {
  //      to: user.email,
  //      subject:'TheEye Profile Alert',
  //      html:html
  //    };
  //    mailer.sendMail(options, error => next(error));
  //  });
  //},
  //sendEmail: function (input, next) {
  //  next || (next = () => {})

  //  var options = {
  //    to: input.user.email,
  //    subject: input.data.subject,
  //    html: input.data.body
  //  }

  //  mailer.sendMail(options, error => next(error))
  //}
