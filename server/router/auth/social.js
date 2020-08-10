const Router = require('express').Router
const passport = require('passport')
const ObjectId = require('mongoose').Types.ObjectId
const { ClientError, ServerError } = require('../../errors')

module.exports = (app) => {
  const router = Router()

  router.get('/:provider', (req, res, next) => {
    try {
      let provider = req.params.provider
      let strategy = app.config.services.authentication.strategies[provider]
      let options = strategy.options

      passport.authenticate(provider, options)(req, res, next)
    } catch (err) {
      logger.error('%o', err)
      return res.sendStatus(400)
    }
  })

  router.get('/:provider/callback', (req, res, next) => {
    let provider = req.params.provider
    passport.authenticate(provider, { failureRedirect: '/login' }, async (err, data) => {
      try {
        if (err) {
          throw err
        }

        let user = data.user
        let passport = data.passport
        let query = { user_id: user._id }

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
    }) (req, res, next)
  })

  const bearerMiddleware = app.service.authentication.middlewares.bearerPassport

  router.delete(
    '/:provider/disconnect/:id',
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
