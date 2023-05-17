const passport = require('passport')
const passportBearer = require('passport-http-bearer').Strategy
const passportBasic = require('passport-http').BasicStrategy
const googleStrategy = require('passport-google-oauth').OAuth2Strategy
const passportLdap = require('passport-ldapauth')
const ldapauth = require('./ldapauth')
const ACL = require('./acl')
const fs = require('fs')

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

      if (this.config.rs256) {
        this.keys = {
          pub: fs.readFileSync(this.config.rs256.pub,'utf8'),
          priv: fs.readFileSync(this.config.rs256.priv,'utf8'),
        }
      } else {
        this.keys = {
          pub: this.config.secret,
          priv: this.config.secret,
        }
      }

      this.acl = new ACL()
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

      this.middlewares = { basicPassport, bearerPassport, ldapPassport, gatewayPassport }
    }

    /**
     *
     * @return {String} token
     *
     */
    issue (payload, options = {}) {
      return jwt.sign(
        payload,
        this.keys.priv, // our Private Key
        {
          expiresIn: options.expiresIn || this.config.expires,
          algorithm: "RS256"
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
      let decoded
      try {
        decoded = jwt.verify(
          token,
          this.keys.pub,
          {}
        )
      } catch (err) {
        if (err.message === 'jwt expired')  {
          throw new ClientError('Token expired')
        } else if (err.message === 'jwt must be provided') {
          throw new ClientError('Invalid Token')
        } else if (err.message === 'jwt signature is required') {
          throw new ClientError('Invalid Token Signature')
        } else {
          throw new ClientError(err.message)
        }
      }

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

    async verifySessionToken (token, next) {
      logger.log('new connection [bearer]')

      try {
        const session = await app.models.session.findOne({ token })
        if (!session) {
          throw new Error('invalid or outdated token')
        }

        const user = await app.models.users.user.findOne({ _id: session.user_id })
        if (!user) {
          throw new Error('user no longer available')
        }

        if (user.enabled === false) {
          app.service.notifications.eventNotifySupport({
            subject: 'USER DISABLED. INVALID BEARER TOKEN.',
            body: `
              <div>
                User is disabled. Bearer session was blocked.<br/>
                <p>Token: ${token}</p>
                <p>id: ${user._id}</p>
                <p>username: ${user.username}</p>
                <p>email: ${user.email}</p>
              </div>
            `
          })

          throw new ClientError('Forbidden', { code: 'Locked', statusCode: 403 })
        }
        
        let decoded
        try {
          decoded = this.verify(token)
        } catch (err) {
          logger.error(err)
        }

        if (!decoded) {
          app.service.notifications.eventNotifySupport({
            subject: 'INVALID JWT.',
            body: `
              <div>
                Invalid bearer session jwt.<br/>
                <p>Token: ${token}</p>
                <p>Decoded: ${JSON.stringify(decoded)}</p>
              </div>
            `
          })
        }


        logger.log('client %s/%s connected [bearer]', user.username, user.email)
        next(null, user, session)
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

        return this.createSession({ member, protocol: passport.protocol })
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
      const { member, protocol } = params

      let expiration = params.expiration
      if (!expiration) {
        let expSecs = this.config.expires
        expiration = new Date()
        expiration.setSeconds(expiration.getSeconds() + expSecs)
      }

      await member
        .populate('user', {
          id: 1,
          credential: 1,
          username: 1,
          email: 1
        })
        .populate('customer', { name: 1 })
        .execPopulate()

      const token = app.service.authentication.issue({
        email: member.user.email,
        username: member.user.username,
        user_id: member.user._id.toString(),
        org_uuid: member.customer.name
      })

      // register issued tokens
      const session = new app.models.session()
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
    async refreshSession (session) {
      const expiration = new Date()
      const expSecs = this.config.expires
      expiration.setSeconds(expiration.getSeconds() + expSecs)

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
        user_id: session.user_id,
        email: session.user.email,
        username: session.user.username,
        org_uuid: session.customer.name
      })

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

  /**
   * internal gateway passwport to communicate micro services
   */
  const gatewayPassport = (req, res, next) => {
    const secret = app.config.supervisor.secret

    const Unauthorized = new Error('Unauthorized')
    Unauthorized.status = 401

    if (!req.query) {
      next( Unauthorized )
    } else if (req.query.secret) {
      if (req.query.secret === secret) {
        next()
      } else {
        logger.error('Invalid internal gateway request. Invalid Secret')
        next( Unauthorized )
      }
    } else if (req.query.gateway_token) {
      try {
        const payload = jwt.verify(req.query.gateway_token, secret, {})
        req.session = payload.context
        next()
      } catch (err) {
        logger.error('Invalid internal gateway request. Invalid Gateway Token')
        next( Unauthorized )
      }
    } else {
      logger.error('Invalid internal gateway request. Not Provided Authentication')
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
