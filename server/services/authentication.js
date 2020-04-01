const app = require('../app')
const passport = require('passport')
const passportBearer = require('passport-http-bearer').Strategy
const passportBasic = require('passport-http').BasicStrategy

const logger = require('./logger')(':services:authentication')

class Authentication {
  constructor (app, config) {
    const basicStrategy = new passportBasic((client_id, client_secret, done) => {
      logger.log('new connection [basic]')

      app.models.user.findOne({
        client_id: client_id,
        client_secret: client_secret
      }, (error, user) => {
        if (error) return done(error); 
        if (!user) {
          logger.error('invalid request, client %s', client_id);
          return done(null, false); 
        } else {
          logger.log('client "%s" connected [basic]', user.client_id);
          return done(null, user);
        }
      })
    })

    const bearerStrategy = new passportBearer((token, done) => {
      logger.log('new connection [bearer]')

      app.models.user.findOne({
        token: token, 
      }, (error, user) => {
        if (error) {
          logger.error('error fetching user by token');
          logger.error(error);
          return done(error);
        } else if (!user) {
          logger.error('invalid or outdated token %s', token);
          return done(null, false); 
        } else {
          logger.log('client "%s" connected [bearer]', user.client_id );
          return done(null, user);
        }
      })
    })

    passport.use(basicStrategy)
    passport.use(bearerStrategy)
  }
}

module.exports = Authentication
