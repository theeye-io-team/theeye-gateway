const swaggerUi = require('swagger-ui-express')
const docs = require('./swagger')

module.exports = (app) => {
  const host = app.config.base_url
  app.api.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(
      Object.assign({}, docs, { host })
    )
  )
}
