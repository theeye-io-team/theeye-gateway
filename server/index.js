
Error.prototype.toJSON = function () {
  let alt = {}
  let storeKey = function (key) {
    if (key === 'stack') {
      if (process.env.NODE_ENV !== 'production') {
        alt[key] = this[key]
      }
    } else {
      alt[key] = this[key]
    }
  }
  Object.getOwnPropertyNames(this).forEach(storeKey, this)
  return alt
}

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
