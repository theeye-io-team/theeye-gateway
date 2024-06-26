const passport = require('passport')
const passportBearer = require('passport-http-bearer').Strategy
const passportBasic = require('passport-http').BasicStrategy
const googleStrategy = require('passport-google-oauth').OAuth2Strategy
const passportLdap = require('passport-ldapauth')
const ldapauth = require('./ldapauth')
const ACL = require('./acl')
const fs = require('fs')

const basicAuthHeaders = require('basic-auth')

const logger = require('../../logger')(':services:authentication')
const EscapedRegExp = require('../../escaped-regexp')
const {
  ClientError,
  ServerError,
  CustomerUniqueIdConflictError,
  CustomerNotFoundError,
  CustomerNotMemberError,
  CustomerDefinitionCorruptedError,
  UserNotMemberError
} = require('../../errors')

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

      this.keys = { secret: this.config.secret }

      if (this.config.rs256?.pub && this.config.rs256?.priv) {
        this.keys.rs256 = {
          pub: fs.readFileSync(this.config.rs256.pub, 'utf8'),
          priv: fs.readFileSync(this.config.rs256.priv, 'utf8')
        }
      }

      this.acl = new ACL()
    }

    async configure () {
      passport.use(new passportBasic(this.verifyUserPassword))
      passport.use(new passportBearer({ passReqToCallback: true }, this.verifySessionToken))

      let strategies = this.config.strategies
      if (strategies.ldapauth) {
        const ldapConfig = Object.assign({},
          strategies.ldapauth,
          { credentialsLookup: basicAuthHeaders }
        )
        const ldapHandler = await ldapauth(app)
        passport.use(new passportLdap(ldapConfig, ldapHandler))
      }

      if (strategies.google) {
        passport.use(new googleStrategy(strategies.google.options, this.verifyGoogle))
      }

      this.middlewares = {
        basicPassport,
        bearerPassport,
        ldapPassport,
        gatewayPassport
      }
    }

    /**
     *
     * @return {String} token
     *
     */
    issue (payload, options = {}) {
      const signSettings = { }

      let privKey
      if (this.keys.rs256) {
        signSettings.algorithm = "RS256"
        privKey = this.keys.rs256.priv
      } else {
        signSettings.algorithm = "HS256"
        privKey = this.keys.secret
      }

      if (options.expiresIn !== null) {
        signSettings.expiresIn = (options.expiresIn || this.config.expires)
      }

      return jwt.sign(payload, privKey, signSettings)
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
      let privKey, algorithms
      if (this.keys.rs256) {
        privKey = this.keys.rs256.priv
        algorithms = [ 'RS256' ]
      } else {
        privKey = this.keys.secret
        algorithms = [ 'HS256' ]
      }

      const decoded = jwt.verify(token, privKey, { algorithms })

      return decoded
    }

    async verifyGoogle (accessToken, refreshToken, profile, done) {
      try {
        let strategy = app.config.services.authentication.strategies['google']
        let options = strategy.options
        let identifier = profile.id
        let email = profile._json.email

        let user = await app.models.users.uiUser.findOne({
          email: new EscapedRegExp(email, 'i'),
          enabled: true
        })

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
        const users = await app.models.users
          .user.find({
            $or: [
              { email: new EscapedRegExp(username, 'i') },
              { username: new EscapedRegExp(username, 'i') }
            ]
          })

        if (users.length > 1) {
          throw new ServerError('Internal Server Error')
        }

        if (users.length === 0) {
          // username does not exists
          throw new ClientError('Unauthorized',{ code: 'UsernameNotFound', statusCode: 401 })
        }

        const user = users[0]
        //if (user.enabled === false) {
        //  app.service.notifications.eventNotifySupport({
        //    subject: 'DISABLED USER LOGIN FORBIDDEN.',
        //    body: `
        //      <div>
        //        User is disabled. Blocked login attempt.<br/>
        //        <p>id: ${user._id}</p>
        //        <p>username: ${user.username}</p>
        //        <p>email: ${user.email}</p>
        //      </div>
        //    `
        //  })

        //  throw new ClientError('Forbidden', { code: 'UsernameLocked', statusCode: 403 })
        //}

        // basic authentication requires a local passport
        const passport = await app.models.passport.findOne({ user: user._id, protocol: 'local' })

        if (!passport) {
          // user is not authorized to authenticate with username / password
          throw new ClientError('Unauthorized', { code: 'LocalPassportNotFound', statusCode: 401 })
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

    async verifySessionToken (req = {}, token, next) {
      logger.log('new connection [bearer]')

      const origin = req.headers?.referer || req.headers?.origin
      const url = `${req.baseUrl}${req.path}`

      try {
        const session = await app.models.session.findOne({ token })
        if (!session) {
          app.service.notifications.eventNotifySupport({
            subject: 'USER ACCESS DENIED',
            body: `
              <div>
                Invalid bearer token<br/>
                <p>Origin: ${origin}</p>
                <p>URL: ${url}</p>
                <p>Token: ${token}</p>
              </div>
            `
          })
          throw new Error('invalid or outdated token')
        }

        const user = await app.models.users.user.findOne({ _id: session.user_id })
        if (!user) {
          app.service.notifications.eventNotifySupport({
            subject: 'USER ACCESS DENIED',
            body: `
              <div>
                Session exists but the user was not found.<br/>
                <p>Origin: ${origin}</p>
                <p>URL: ${url}</p>
                <p>Token: ${token}</p>
                <p>id: ${session.user_id}</p>
              </div>
            `
          })
          throw new Error('user no longer available')
        }

        if (user.enabled === false) {
          app.service.notifications.eventNotifySupport({
            subject: 'USER ACCESS DENIED',
            body: `
              <div>
                User is disabled. Bearer token is blocked.<br/>
                <p>Origin: ${origin}</p>
                <p>URL: ${url}</p>
                <p>Token: ${token}</p>
                <p>id: ${user._id}</p>
                <p>username: ${user.username}</p>
                <p>email: ${user.email}</p>
              </div>
            `
          })

          throw new ClientError('Forbidden', { code: 'Locked', statusCode: 403 })
        }

        // register token last usage
        // performance issues. this is producing a lot of db writing
        //user.last_access = new Date()
        //await user.save().catch(err => {
        //  app.service.notifications.eventNotifySupport(err)
        //})

        const jwt_verify = (app.config.services.authentication.jwt_verify || {})
        if (
          session.credential !== 'integration' &&
          jwt_verify.enable_check === true
        ) {
          let decoded
          try {
            decoded = app.service.authentication.verify(token)
          } catch (err) {
            //if (err.message === 'jwt expired')  {
            //  throw new ClientError('Token expired')
            //} else if (err.message === 'jwt must be provided') {
            //  throw new ClientError('Invalid Token')
            //} else if (err.message === 'jwt signature is required') {
            //  throw new ClientError('Invalid Token Signature')
            //} else {
            //  throw new ClientError(err.message)
            //}
            if (
              err.message !== 'jwt expired' ||
              jwt_verify.expired_notify === true
            )  {
              // only notify security errors
              app.service.notifications.eventNotifySupport({
                subject: 'USER ACCESS DENIED',
                body: `
                  <div>
                    JWT token verification failed.<br/>
                    <p>Origin: ${origin}</p>
                    <p>URL: ${url}</p>
                    <p>reason: ${err.message}</p>
                    <p>id: ${user._id}</p>
                    <p>username: ${user.username}</p>
                    <p>email: ${user.email}</p>
                    <p>Token: ${token}</p>
                  </div>
                `
              })
            }

            if (jwt_verify.reject_login === true) {
              throw new ClientError(err.message, { statusCode: 401 })
            }
          }
        }

        logger.log('client %s/%s connected [bearer]', user.username, user.email)
        if (next) {
          next(null, user, session)
        } else {
          return { user, session }
        }
      } catch (err) { // jwt verify error
        logger.error(err)
        unauthorized(next)
      }
    }

    async membersLogin ({ user, passport, customerName = null }) {
      try {
        let customer
        if (customerName !== null) {
          const customers = await app.models.customer.find({
            $or: [
              // uuid or legacy unrestricted string
              { $and: [
                { name: customerName },
                { name: { $ne: null } },
                { name: { $exists: true } },
              ] },
              { $and: [
                { alias: customerName },
                { alias: { $ne: null } },
                { alias: { $exists: true } },
              ] }
            ]
          })

          if (customers.length !== 1) {
            if (customers.length === 0) {
              throw new CustomerNotFoundError({
                passport,
                user,
                customer: { name: customerName }
              })
            } else {
              throw new CustomerUniqueIdConflictError({
                passport,
                user,
                customer: { name: customerName },
                customers: customers.map(c => c.name)
              })
            }
          }

          customer = customers[0]
          if (!customer._id || !customer.name) {
            throw new CustomerDefinitionCorruptedError({
              passport,
              user,
              customer
            })
          }
        }

        const query = { user_id: user._id }
        if (customer) {
          query.customer_id = customer._id
        }

        const memberOf = await app.models.member.find(query)
        if (memberOf.length === 0) {
          if (customer) {
            throw new CustomerNotMemberError({ passport, user, customer })
          } else {
            throw new UserNotMemberError({ passport, user })
          }
        }

        let member
        if (Boolean(user.current_customer_id)) {
          member = memberOf.find(member => {
            return member.customer_id.toString() == user.current_customer_id?.toString()
          })
        }

        if (!member) {
          member = memberOf[0]
          // update current customer
          user.current_customer_id = member.customer_id
          await user.save()
        }

        return this.createSession({ member, passport })
      } catch (err) {
        logger.error(err)
        const data = err.data

        app.service.notifications.eventNotifySupport({
          subject: 'MEMBER LOGIN ALERT',
          body: `
            <div>
              ${err.message}<br/>
              <p>id: ${user?._id}</p>
              <p>username: ${user?.username}</p>
              <p>email: ${user?.email}</p>
              <p>auth method: ${passport?.protocol}</p>
            </div>
          `
        })

        // continue throwing Forbidden error
        throw new ClientError('Forbidden', {
          message: 'Forbidden',
          reason: 'Not Allowed',
          statusCode: 403
        })
      }
    }

    /**
     * @param {Object} params
     * @property {Member} params.member
     * @property {Passport} params.passport
     * @return {Promise} session
     */
    async createSession (params) {
      const { member, passport } = params

      let expirationDate, expirationSeconds
      if (params.neverExpires === true) {
        expirationSeconds = null
        expirationDate = null
      } else {
        expirationSeconds = this.config.expires
        // expiration data in seconds from now
        expirationDate = new Date()
        expirationDate.setSeconds(expirationDate.getSeconds() + expirationSeconds)
      }

      await member
        .populate('user', {
          id: 1,
          credential: 1,
          username: 1,
          email: 1
        })
        .populate('customer', { name: 1, config: 1 })
        .execPopulate()

      if (!member.user) {
        throw new ClientError('Invalid session. User is no longer available')
      }
      if (!member.customer) {
        throw new ClientError('Invalid session. Organization is no longer available')
      }

      const credential = (member.user?.credential || member.credential)

      const token = app.service.authentication.issue({
        issuer: passport.provider,
        email: member.user.email,
        username: member.user.username,
        user_id: member.user._id.toString(),
        org_uuid: member.customer?.name,
        credential
      }, {
        expiresIn: expirationSeconds
      })

      // register issued tokens
      const session = new app.models.session()
      session.token = token
      session.expires = expirationDate
      session.user = member.user_id
      session.user_id = member.user_id
      session.member = member._id
      session.member_id = member._id
      session.customer = member.customer_id
      session.customer_id = member.customer_id
      session.protocol = passport.protocol
      session.provider = passport.provider
      session.credential = credential

      return session.save()
    }

    /**
     * @param {Session}
     * @return {Promise}
     */
    async refreshSession (session) {
      const expirationDate = new Date()
      const expirationSeconds = this.config.expires
      expirationDate.setSeconds(expirationDate.getSeconds() + expirationSeconds)

      await session
        .populate('user', {
          id: 1,
          credential: 1,
          username: 1,
          email: 1
        })
        .populate('customer', { name: 1 })
        .execPopulate()

      const token = app.service.authentication.issue({
        email: session.user.email,
        username: session.user.username,
        user_id: session.user_id,
        org_uuid: session.customer?.name,
        credential: session.credential
      }, {
        expiresIn: expirationSeconds
      })

      // register issued tokens with new expiration date
      session.token = token
      session.expires = expirationDate
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

  /**
   * internal gateway passwport to communicate micro services
   */
  const gatewayPassport = (req, res, next) => {
    const secret = app.config.services.authentication.secret

    const Unauthorized = new Error('Unauthorized')
    Unauthorized.status = 401

    if (!req.query) {
      next( Unauthorized )
    //} else if (req.query.secret) {
    //  if (req.query.secret === secret) {
    //    next()
    //  } else {
    //    logger.error('Invalid internal gateway request. Invalid Secret')
    //    next( Unauthorized )
    //  }
    } else if (req.query.gateway_token) {
      try {
        const payload = app.service.authentication.verify(req.query.gateway_token)
        req.session = payload.context
        next()
      } catch (err) {
        logger.error('Invalid internal gateway request. Invalid gateway token. %s', err.message)
        logger.reqErrorDump(req)
        next( Unauthorized )
      }
    } else {
      logger.error('Invalid internal gateway request. Gateway token was not provided')
      logger.reqErrorDump(req)
      next( Unauthorized )
    }
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
      if ( /connect ECONNREFUSED/.test(err.message) ) {
        res.status(503)
        res.json({ message: 'Cannot connect the Domain Controller authentication service' })
      } else {
        if (err.status >= 400) {
          res.status(err.status)
          res.json(err.message)
        } else {
          next(err)
        }
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
