const passport = require('passport')
const passportBearer = require('passport-http-bearer').Strategy
const passportBasic = require('passport-http').BasicStrategy
const passportLdap = require('passport-ldapauth')
const ldapauth = require('./ldapauth')

const logger = require('../../logger')(':services:authentication')
const { ClientError } = require('../../errors')

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

      passport.use(new passportBasic(this.verifyUserPassword))
      passport.use(new passportBearer(this.verifySessionToken))

      if (this.config.strategies.ldapauth) {
        passport.use(new passportLdap(this.config.strategies.ldapauth, ldapauth(app)))
      }

      this.middlewares = { basicPassport, bearerPassport, ldapPassport }
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
    verify (token) {
      let decoded = jwt.verify(
        token,
        this.config.secret,
        {}
      )

      return decoded
    }

    async verifyUserPassword (username, password, next) {
      try {
        logger.log('new connection [basic]')
        let user = await userFetch({ $or: [{ email: username }, { username }] })

        if (!user) {
          // username does not exists
          throw new ClientError('Unauthorized',{code: 'UsernameNotFound', statusCode: 401})
        }

        // basic authentication requires a local passport
        let passport = await app.models.passport.findOne({ user: user._id, protocol: 'local' })

        if (!passport) {
          // user is not authorized to authenticate with username / password
          throw new ClientError('Unauthorized',{code: 'LocalPassportNotFound', statusCode: 401})
        }

        // verify provided password
        await passport.validatePassword(password)

        // WARNING ! dont change. password is changed if .save is used.
        // every time passport is saved the password is bcrypted
        await app.models.passport.updateOne({ _id: passport._id },{ $set: { last_login: new Date() } })

        logger.log('client %s/%s connected [basic]', user.username, user.email)
        return next(null, { user, passport })
      } catch (err) {
        if (err.message === 'InvalidPassword') {
          logger.error(`unauthorized. u:${username}/p:${password}`)
          return unauthorized(next)
        } else {
          logger.error(err)
          return next(err)
        }
      }
    }

    verifySessionToken (token, next) {
      logger.log('new connection [bearer]')

      const findError = (err) => {
        logger.error('error fetching user by token')
        logger.error(err)
        return next(err)
      }

      const success = async (session) => {
        // fetch profile
        try {
          let user = await userFetch({ _id: session.user_id })
          if (!user) {
            // why ??
            unauthorized(next)
          } else {
            logger.log('client %s/%s connected [bearer]', user.username, user.email)
            next(null, user, session)
          }
        } catch (err) {
          next(err)
        }
      }

      try {
        //let decoded = app.service.authentication.verify(token)
        app.models.session
          .findOne({ token })
          .exec((err, session) => {
            if (err) { findError(err) }
            else if (!session) {
              logger.error('invalid or outdated token %s', token)
              unauthorized(next)
            }
            else { success(session) }
          })
      } catch (err) { // jwt verify error
        logger.error(err)
        unauthorized(next)
      }
    }

    /**
     * @param {Object} params
     * @property {Member} params.member
     * @property {Passport} params.passport
     * @return {Promise}
     */
    async createSession (params) {
      let { member, protocol, expiration } = params

      if (expiration !== undefined) {
        expiration = params.expiration
      } else {
        let expSecs = this.config.expires
        expiration = new Date()
        expiration.setSeconds(expiration.getSeconds() + expSecs)
      }

      let token = app.service.authentication.issue({ user_id: member.user_id })

      await member.populate('user', { id: 1, credential: 1 }).execPopulate()

      // register issued tokens
      let session = new app.models.session()
      session.token = token
      session.expires = expiration
      session.user = member.user_id
      session.user_id = member.user_id
      session.member = member._id
      session.member_id = member._id
      session.customer = member.customer_id
      session.customer_id = member.customer_id
      session.protocol = protocol

      if (member.user.credential) {
        session.credential = member.user.credential
      } else {
        session.credential = member.credential
      }

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

  const bearerPassport = (req, res, next) => {
    passport.authenticate('bearer', (err, user, session) => {
      if (err) {
        if (err.status >= 400) {
          res.status(err.status)
          return res.json(err.message)
        }
        next(err)
      } else if (user === false || !user) {
        let err = unauthorized()
        return res.status(err.statusCode).json(err.message)
      } else {
        req.session = session
        req.user = user
        next()
      }
    }, {session: false})(req, res, next)
  }

  const basicPassport = (req, res, next) => {
    passport.authenticate('basic', (err, auth) => {
      if (err) {
        if (err.status >= 400) {
          res.status(err.status)
          return res.json(err.message)
        }
        next(err)
      } else {
        if (!auth || !auth.user) {
          logger.log('Invalid credentials.')
          let err = unauthorized()
          return res.status(err.statusCode).json(err.message)
        } else {
          let { user, passport } = auth
          req.user = user
          req.passport = passport
          next()
        }
      }
    }, {session: false})(req, res, next)
  }

  const ldapPassport = (req, res, next) => {
    passport.authenticate('ldapauth', (err, auth) => {
      let { user, passport } = auth
      if (err) {
        if (err.status >= 400) {
          res.status(err.status)
          return res.json(err.message)
        }
        next(err)
      } else {
        if (user === false || !user) {
          logger.log('Invalid credentials.')
          let err = unauthorized()
          return res.status(err.statusCode).json(err.message)
        }
        req.user = user
        req.passport = passport
        next()
      }
    }, {session: false})(req, res, next)
  }

  const userFetch = (where) => {
    return new Promise((resolve, reject) => {
      app.models.users.user
        .findOne(where)
        .exec((err, user) => {
          if (err) { reject(err) }
          else { resolve(user) }
        })
    })
  }

  const unauthorized = (next) => {
    let err = new Error('Unauthorized')
    err.statusCode = 401
    next && next(err, false)
    return err
  }

  return new Authentication()
}
