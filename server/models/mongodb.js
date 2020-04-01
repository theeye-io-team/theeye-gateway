const mongoose = require('mongoose')
const debug = require('debug')('eye:mongodb')
const format = require('util').format

class Connection {
  constructor (config) {
    this.config = config

    this.db = null
  }

  connect () {
    return new Promise( (resolve, reject) => {
      if (this.db) {
        return resolve(this.db)
      }

      let db = connect(this.config)

      db.on('error', (err) => {
        throw err
      })

      db.once('close', () => {
        let err = new Error('MongoDB connection closed')
        throw err
      })

      db.once('connected', () => {
        debug('MongoDB connected')
        resolve(db)
      })

      this.db = db
    })
  }

  disconnect () {
    return this.db.close()
  }
}

module.exports = Connection

const connect = (config) => {
  let connectionString

  if (!config) {
    throw new Error('no mongo db connection provided!')
  }

  if (config.user && config.password) {
    connectionString = format(
      'mongodb://%s:%s@%s/%s',
      encodeURIComponent(config.user),
      encodeURIComponent(config.password),
      config.hosts,
      config.database
    )
  } else {
    connectionString = format(
      'mongodb://%s/%s',
      config.hosts,
      config.database
    )
  }

  if (config.replicaSet) {
    connectionString += `?replicaSet=${config.replicaSet}`
  }

  if (config.debug) {
    mongoose.set("debug", true)
  }

  return mongoose.createConnection(connectionString, (config.options||{}))
}
