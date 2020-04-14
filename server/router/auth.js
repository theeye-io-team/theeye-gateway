const express = require('express')
const passport = require('passport')
const logger = require('../logger')('router:auth')

module.exports = (app) => {
  const router = express.Router()

  //const bearerMiddleware = app.service.authentication.middlewares.bearerPassport
  router.post(
    '/login',
    app.service.authentication.middlewares.basicPassport,
    async (req, res, next) => {
      try {
        let user = req.user
        let customer = req.query.customer || null
        let query = { user_id: user._id }
        if (customer) {
          query.customer_name = customer
        }

        let memberOf = await app.models.member.find(query)

        if (memberOf.length === 0) {
          return res
            .status(403)
            .json({
              message: 'Forbidden',
              reason: 'you are not a member',
              statusCode: 403
            })
        }

        let member = memberOf[0]
        const session = await app.service.authentication.createSession(member)
        res.json({ access_token: session.token })
      } catch (err) {
        logger.error(err)
        res.status(500).json({message:'internal server error'})
      }
    }
  )

  /**
   *
   * send reset password email
   *
   */
  router.post(
    '/password/recover',
    (req, res, next) => {
      if (sails.config.passport.ldapauth) {
        return res.send(400, {error: 'ldapSet'});
      }
      var email = req.params.all().email; // every posible param
      logger.debug('searching ' + email);

      User.findOne({ email: email },function(err,user){
        if( err ) return res.send(500,err);
        if( ! user ) return res.send(400,"User not found");

        let token = app.service.authentication.issue({ user }, { expiresIn: "12h" })
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
    }
  )

  router.get(
    '/password/recoververify',
    (req, res, next) => {
      try {
        if (!req.query.token) {
          return res.send(400)
        }

        let decoded = app.service.authentication.verify(req.query.token)
        var user = decoded.user

        var resetToken = app.service.authentication.issue({ user }, { expiresIn: "5m" })
        return res.json({ resetToken })
      } catch (err) {
        logger.error('%o', err)
        return res.send(400)
      }
    }
  )

  router.put(
    '/password/reset',
    (req, res, next) => {
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
  )

  return router
}
