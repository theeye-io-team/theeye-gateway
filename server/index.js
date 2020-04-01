const App = require('./app')
const config = require('./config')

const app = module.exports = new App()

const boot = async () => {
  await app.configure(config)
  app.start()
}

boot()
