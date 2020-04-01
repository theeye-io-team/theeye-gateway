const express = require('express')
const passport = require('passport')
const app = require('../app')

module.exports = () => {
  const router = express.Router()

  router.post(
    '/login',
    passport.authenticate('basic', { session: false }),
    controller.login
  )

  router.post(
    '/logout',
    passport.authenticate('bearer', { session: false }),
    controller.logout
  )

  router.post('/password/recover', controller.passwordRecover)
  router.get('/password/recoververify', controller.passwordRecoverVerify)
  router.put('/password/reset', controller.passwordReset)

  return router
}

const controller = {
  login (req, res) {
    var user = req.user
    let token = app.tokens.issue({ user_id: user.client_id })
    // TODO: register all issued tokens
    res.send({ token })
  },
  logout (req, res, next) {
    if (!req.user) {
      return res.send(400)
    }
    // TODO: de-register issued token
    // let token = req.query.access_token
    res.send(200)
  },
  /**
   *
   * send reset password email
   *
   */
  passwordRecover (req, res, next) {
    if (sails.config.passport.ldapauth) {
      return res.send(400, {error: 'ldapSet'});
    }
    var email = req.params.all().email; // every posible param
    logger.debug('searching ' + email);

    User.findOne({ email: email },function(err,user){
      if( err ) return res.send(500,err);
      if( ! user ) return res.send(400,"User not found");

      var token = app.tokens.issue({ user: user }, { expiresIn: "12h" })
      var url = passport.protocols.local.getPasswordResetLink(token)

      mailer.sendPasswordRecoveryEMail({
        url: url,
        user: user
      },function(err){
        if(err) {
          logger.error("Error sending email to " + email);
          logger.error('%o',err);
          return res.send(500,err);
        }

        return res.send(200,{ message: 'ok' });
      })
    })
  },
  passwordRecoverVerify (req, res, next) {
    try {
      if (!req.query.token) {
        return res.send(400)
      }

      let decoded = app.tokens.verify(req.query.token)
      var user = decoded.user
      var resetToken = app.tokens.issue({user:user},{ expiresIn: "5m" })
      return res.json({ resetToken })
    } catch (err) {
      logger.error('%o', err)
      return res.send(400)
    }
  },
  passwordReset (req, res, next) {
    var params = req.params.all()

    if(
      ! params.token ||
      ! params.password ||
      ! params.confirmation
    ) {
      return res.send(400)
    }

    if (params.password != params.confirmation) {
      return res.send(400,'Passwords does not match')
    }

    try {
      let decoded = app.tokens.verify(params.token)
      var user = decoded.user;
      passport.protocols.local.reset({
        email: user.email,
        password: params.password
      }, err => {
        if(err){
          if(err.message == 'Invalid password'){
            return res.send(400, 'The password must have at least 8 characters long')
          }
          logger.error('%o', err)
          return res.send(500, 'Error updating password, try again.')
        }
        res.send(200)
      })
    } catch (err) {
      logger.error('%o',err)
      return res.send(400,'Invalid password reset token, try again.')
    }
  }
}
