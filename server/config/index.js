
const path = require('path')
const env = process.env.NODE_ENV
const base = require(path.join(__dirname, 'default'))

let config
if (!env) {
  config = Object.assign({}, base)
} else {
  config = Object.assign({}, base, require(path.join(__dirname, env)))
}

module.exports = config
