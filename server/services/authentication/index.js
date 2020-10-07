const passport = require('passport')
const passportBearer = require('passport-http-bearer').Strategy
const passportBasic = require('passport-http').BasicStrategy
const googleStrategy = require('passport-google-oauth').OAuth2Strategy
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
    }

    async configure () {
      passport.use(new passportBasic(this.verifyUserPassword))
      passport.use(new passportBearer(this.verifySessionToken))

      let strategies = this.config.strategies
      if (strategies.ldapauth) {
        const ldapHandler = await ldapauth(app)
        passport.use(new passportLdap(strategies.ldapauth, ldapHandler))
      }

      if (strategies.google) {
        passport.use(new googleStrategy(strategies.google.options, this.verifyGoogle))
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

    async verifyGoogle (accessToken, refreshToken, profile, done) {
      try {
        let strategy = app.config.services.authentication.strategies['google']
        let options = strategy.options
        let identifier = profile.id
        let email = profile._json.email

        let user = await app.models.users.uiUser.findOne({email: email, enabled: true})

        if (!user) {
          let err = new Error('User not found')
          err.status = 404
          throw err
        }

        let passportData = {
          protocol: options.protocol,
          provider: 'google',
          identifier: identifier,
          user_id: user._id,
          user: user._id,
        }

        let passport = await app.models.passport.findOne(passportData)
        if (!passport) {
          passportData.last_login = new Date()
          passport = await app.models.passport.create(passportData)
        } else {
          passport.last_login = new Date()
          passport.save()
        }


        done (null, { user, passport })
      } catch (err) {
        done(err)
      }
    }

    async verifyUserPassword (username, password, next) {
      try {
        logger.log('new connection [basic]')
        let user = await app.models.users
          .user.findOne({ $or: [{ email: username }, { username }] })

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
        //await app.models.passport.updateOne({ _id: passport._id },{ $set: { last_login: new Date() } })

        passport.last_login = new Date()
        await passport.save()

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

    async verifySessionToken (token, next) {
      logger.log('new connection [bearer]')

      try {
        //let decoded = app.service.authentication.verify(token)
        let session = await app.models.session.findOne({ token })
        if (!session) {
          throw new Error('invalid or outdated token')
        }

        let user = await app.models.users.user.findOne({ _id: session.user_id })
        if (!user) {
          throw new Error('user no longer available')
        }

        logger.log('client %s/%s connected [bearer]', user.username, user.email)
        next(null, user, session)
      } catch (err) { // jwt verify error
        logger.error(err)
        unauthorized(next)
      }
    }

    async membersLogin ({ user, passport, customerName }) {
      let query = { user_id: user._id }
      if (customerName) {
        query.customer_name = customerName
      }

      let memberOf = await app.models.member.find(query)
      if (memberOf.length === 0) {
        app.service.notifications.eventNotifySupport({
          subject: 'USER LOGIN MEMBERS ERROR.',
          body: `
            <div>
              User is not assigned to any Organization. Cannot login.<br/>
              <p>id: ${user._id}</p>
              <p>username: ${user.username}</p>
              <p>email: ${user.email}</p>
            </div>
          `
        })

        throw new ClientError('Forbidden', {
          message: 'Forbidden',
          reason: 'not a member',
          statusCode: 403
        })
      }

      let member = memberOf[0]
      return this.createSession({ member, protocol: passport.protocol })
    }

    /**
     * @param {Object} params
     * @property {Member} params.member
     * @property {Passport} params.passport
     * @return {Promise} session
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
    const loginFailed = (user) => {
      logger.log('Invalid LDAP credentials.')

      if (app.config.services.authentication.localBypass === true) {
        logger.log('Local Login Fallback Enabled.')
        return basicPassport(req, res, next)
      }

      let err = unauthorized()
      return res.status(err.statusCode).json(err.message)
    }

    const loginError = (err) => {
      logger.error(err)

      if (err.status >= 400) {
        res.status(err.status)
        res.json(err.message)
      } else {
        next(err)
      }

      return
    }

    passport.authenticate('ldapauth', (err, auth) => {
      if (err) {
        return loginError(err)
      }

      const { user, passport } = auth

      if (user === false || !user) {
        return loginFailed(user)
      }

      req.user = user
      req.passport = passport
      next()
    }, { session: false })(req, res, next)
  }

  const unauthorized = (next) => {
    let err = new Error('Unauthorized')
    err.statusCode = 401
    next && next(err, false)
    return err
  }

  return new Authentication()
}
