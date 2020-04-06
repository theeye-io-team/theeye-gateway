const passport = require('passport')
const passportBearer = require('passport-http-bearer').Strategy
const passportBasic = require('passport-http').BasicStrategy

const logger = require('../logger')(':services:authentication')

/**
 * jwToken
 *
 * @description :: JSON Webtoken Service
 */
const jwt = require('jsonwebtoken')

module.exports = function (app) {

  class Authentication {
    constructor () {
      this.config = app.config.services.authentication
    }

    /**
     *
     * @return {String} token
     *
     */
    issue (payload, options = {}) {
      return jwt.sign(
        payload,
        this.config.secret, // our Private Key
        {
          expiresIn: options.expiresIn || this.config.expires
        }
      )
    }

    /**
     *
     * for more option see https://github.com/auth0/node-jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback
     *
     * @return {Object} decoded token
     * @throws
     *
     */
    verify (payload) {
      let decoded = jwt.verify(
        token,
        this.config.secret,
        {}
      )

      return decoded
    }

    middleware (app) {

      const userFetch = (where) => {
        return new Promise((resolve, reject) => {
          app.models
            .user
            .findOne(where)
            .exec((err, user) => {
              if (err) { reject(err) }
              else { resolve(user) }
            })
        })
      }

      const basicStrategy = new passportBasic(async (username, password, next) => {
        try {
          logger.log('new connection [basic]')
          let user = await userFetch({ $or: [{ email: username }, { username }] })

          if (!user) {
            logger.error('invalid request, client %s', username)
            //return next(null, false)
            let err = new Error('unauthorized')
            err.status = 401
            return next(err)
          }

          // basic authentication requires a local passport
          let passport = await app.models.passport.findOne({ user: user._id, protocol: 'local' })

          await passport.validatePassword(password)

          logger.log('client %s/%s connected [basic]', user.username, user.email)
          return next(null, user)
        } catch (err) {
          if (err.message === 'InvalidPassword') {
            logger.error(`unauthorized. u:${username}/p:${password}`)
            let err = new Error('unauthorized')
            err.status = 401
            return next(err)
          } else {
            logger.error('error fetching user by token')
            logger.error(err)
            return next(err)
          }
        }
      })

      const bearerStrategy = new passportBearer((token, next) => {
        logger.log('new connection [bearer]')

        const findError = (err) => {
          logger.error('error fetching user by token')
          logger.error(err)
          return next(err)
        }

        const unauthorized = () => {
          logger.error('invalid or outdated token %s', token)
          let err = new Error('unauthorized')
          err.statusCode = 401
          return next(err, false)
        }

        const success = async (session) => {
          // fetch profile
          try {
            let user = await userFetch({ _id: session.user_id })
            if (!user) {
              // why ??
              unauthorized()
            } else {
              logger.log('client %s/%s connected [bearer]', user.username, user.email)
              next(null, user, session)
            }
          } catch (err) {
            next(err)
          }
        }

        app.models.session
          .findOne({ token })
          .exec((err, session) => {
            if (err) { findError(err) }
            else if (!session) { unauthorized() }
            else { success(session) }
          })
      })

      passport.use(basicStrategy)
      passport.use(bearerStrategy)

      const bearerPassport = (req, res, next) => {
        passport.authenticate('bearer', (err, user, session) => {
          if (err) {
            if (err.status >= 400) {
              res.status(err.status)
              return res.json(err.message)
            }
            next(err)
          } else {
            req.session = session
            req.user = user
            next()
          }
        }, {session: false})(req, res, next)
      }

      const basicPassport = (req, res, next) => {
        passport.authenticate('basic', (err, user) => {
          if (err) {
            if (err.status >= 400) {
              res.status(err.status)
              return res.json(err.message)
            }
            next(err)
          } else {
            req.user = user
            next()
          }
        }, {session: false})(req, res, next)
      }

      this.middlewares = { basicPassport, bearerPassport }
    }

    /**
     * @param {Member}
     * @return {Promise}
     */
    createSession (member) {
      let expiration = new Date()
      let expSecs = this.config.expires
      expiration.setSeconds(expiration.getSeconds() + expSecs)

      let token = app.service.authentication.issue({ user_id: member.user_id })

      // register issued tokens
      let session = new app.models.session()
      session.token = token 
      session.expires = expiration
      session.user = member.user_id
      session.user_id = member.user_id
      session.member = member._id
      session.member_id = member._id
      session.customer = member.customer._id
      session.customer_id = member.customer._id
      return session.save()
    }

    /**
     * @param {Session}
     * @return {Promise}
     */
    refreshSession (session) {
      let expiration = new Date()
      let expSecs = this.config.expires
      expiration.setSeconds(expiration.getSeconds() + expSecs)

      let token = app.service.authentication.issue({ user_id: session.user_id })

      // register issued tokens
      session.token = token 
      session.expires = expiration
      return session.save()
    }
  }

  return new Authentication()
}
