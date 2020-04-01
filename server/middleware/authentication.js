const passport = require('passport')
const passportBearer = require('passport-http-bearer').Strategy
const passportBasic = require('passport-http').BasicStrategy

const logger = require('../logger')(':services:authentication')

class Authentication {
  constructor (app) {
    const basicStrategy = new passportBasic((email, password, done) => {
      logger.log('new connection [basic]')

      app.models
        .user
        .findOne({ $or: [{ email, username }], password })
        .exec((err, user) => {
          if (err) {
            logger.error('error fetching user by token')
            logger.error(err)
            return done(err)
          }

          if (!user) {
            logger.error('invalid request, client %s', client_id)
            return done(null, false)
          }

          logger.log('client "%s" connected [basic]', user.client_id)
          return done(null, user)
        })
    })

    const bearerStrategy = new passportBearer((token, done) => {
      logger.log('new connection [bearer]')

      app.models.session.findOne({
        token, 
      }, (err, user) => {
        if (err) {
          logger.error('error fetching user by token')
          logger.error(err)
          return done(err)
        } else if (!user) {
          logger.error('invalid or outdated token %s', token)
          return done(null, false)
        } else {
          logger.log('client "%s" connected [bearer]', user.client_id)
          return done(null, user)
        }
      })
    })

    passport.use(basicStrategy)
    passport.use(bearerStrategy)
  }
}

module.exports = Authentication
