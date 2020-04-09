const Mailer = require('./mailer')
const logger = require('../../../logger')('services:mailer')

class Email {
  constructor (app, config) {
    this.mailer = new Mailer(config)
  }

  send (options, next) {
    next || (next = () => {})

    this.mailer.sendMail(options, error => next(error))
  }
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
