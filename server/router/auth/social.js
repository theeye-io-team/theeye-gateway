const Router = require('express').Router
const Passport = require('passport')
const ObjectId = require('mongoose').Types.ObjectId
const { OAuth2Client } = require('google-auth-library')
const logger = require('../../logger')('router:auth')
const { ClientError, ServerError } = require('../../errors')

module.exports = (app) => {
  const router = Router()

  router.get('/:provider', (req, res, next) => {
    try {
      let provider = req.params.provider
      let strategy = app.config.services.authentication.strategies[provider]
      let options = strategy.options

      Passport.authenticate(provider, options)(req, res, next)
    } catch (err) {
      logger.error('%o', err)
      return res.sendStatus(400)
    }
  })

  router.post('/:provider/verifytoken', async (req, res, next) => {
    let provider = req.params.provider
    let strategy = app.config.services.authentication.strategies[provider]
    let options = strategy.options
    if (!strategy) {
      throw new Error(`Strategy ${provider} not found on config file.`)
    }

    if (provider === 'googlemobile') {
      let idToken = req.body.idToken
      let email = req.body.email
      if (!idToken) {
        throw new ClientError('idToken is required')
      }
      if (!email) {
        throw new ClientError('email is required')
      }

      try {
        // verificar el idToken conforme:
        // https://developers.google.com/identity/sign-in/web/backend-auth
        const CLIENT_ID = options.clientID
        const client = new OAuth2Client(CLIENT_ID)
        const ticket = await client.verifyIdToken({
          idToken: idToken,
          audience: CLIENT_ID
        })
        // valido el payload
        const payload = ticket.getPayload()
        const identifier = payload['sub']
        if (!identifier || email !== payload['email']) {
          throw new ClientError('Invalid social credentials.', { statusCode: 404 })
        }

        // verifico user
        const user = await app.models.users.uiUser.findOne({
          email: new RegExp(email, 'i')
        })

        if (!user) {
          throw new ClientError('User email not found.', { statusCode: 404 })
        }

        // verifico passport
        let passport = await app.models.passport.findOne({
          user: user._id,
          protocol: options.protocol,
          provider: provider
        })

        if (!passport) {
          let passportData = {
            protocol: options.protocol,
            provider: provider,
            identifier: identifier,
            user_id: user._id,
            user: user._id,
            last_login: new Date()
          }

          passport = await app.models.passport.create(passportData)
        }

        let customerName = req.query.customer || null
        // hago el login
        let session = await app.service.authentication.membersLogin({ user, passport, customerName })
        res.json({ access_token: session.token })
      } catch (err) {
        logger.error('%o', err)
        next(err)
      }
    }
  })

  router.get('/:provider/callback', (req, res, next) => {
    let provider = req.params.provider
    Passport.authenticate(provider, { failureRedirect: '/login' }, async (err, data) => {
      try {
        if (err) { throw err }

        let user = data.user
        let passport = data.passport

        let memberOf = await app.models.member.find({ user_id: user._id })

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
        const session = await app.service.authentication.createSession({ member, protocol: passport.protocol })

        const queryString = new Buffer( JSON.stringify({ access_token: session.token }) ).toString('base64')
        return res.redirect('/sociallogin?' + queryString)
      } catch (err) {
        if (err.status) {
          let message = err.status === 404 ? err.message : 'Login error, please try again later.'
          const queryString = new Buffer( JSON.stringify({ error: message }) ).toString('base64')
          return res.redirect('/sociallogin?' + queryString)
        }
      }
    })(req, res, next)
  })

  const bearerMiddleware = app.service.authentication.middlewares.bearerPassport

  router.delete( '/:provider/disconnect/:id',
    bearerMiddleware,
    async (req, res, next) => {
      try {
        const provider = req.params.provider
        const id = req.params.id

        const passport = await app.models.passport.findOne({
          provider,
          _id: ObjectId(id),
          user_id: req.user._id // force current user, to not delete anyone else's passport
        })

        if (!passport) {
          throw new ClientError(
            `user provider passport not found`,
            { statusCode: 404 }
          )
        }

        await passport.remove()
        res.status(200).json('ok')
      } catch (err) {
        next(err)
      }
    }
  )

  return router
}
