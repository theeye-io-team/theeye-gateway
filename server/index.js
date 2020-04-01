const app = require('./app')
const config = require('./config')

const main = async () => {
  await app.configure(config)
  app.start()
}

main()
