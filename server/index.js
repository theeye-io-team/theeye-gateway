const App = require('./app')
const config = require('./config')

const app = module.exports = new App()

const boot = async (app) => {
  await app.configure(config)

  console.log('app ready')

  // start the server if `$ node server.js`
  if (require.main === module) {
    app.start()
  }
}

boot(app)
