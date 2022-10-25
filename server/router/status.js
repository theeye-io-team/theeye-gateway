const os = require('os')
const exec = require('child_process').exec
const express = require('express')
const logger = require('../logger')('router:status')

module.exports = (app) => {
  const router = express.Router()

  router.get('/', nodeStatus)

  return router
}

const nodeStatus = async (req, res, next) => {
  try {
    let message = { status: `Node is ok.` }

    message.node_hostname = process.env.THEEYE_NODE_HOSTNAME || os.hostname()
    message.node_uptime = new Date(Date.now() - os.uptime()*1000)
    message.process_uptime = new Date(Date.now() - process.uptime()*1000)
    message.theeye_version = (await getVersion().catch(err => '')).trim()
    message.load_average = os.loadavg()

    res.status(200).json(message)
  } catch (err) {
    res.status(500).json(err)
  }
}

const getVersion = () => {
  return new Promise( (resolve, reject) => {
    if (process.env.APP_VERSION) {
      return resolve(process.env.APP_VERSION)
    }

    const cmd = 'cd ' + process.cwd() + ' && git describe'
    exec(cmd, {}, (err, stdout, stderr) => {
      if (err) reject(err)
      resolve(stdout)
    })
  })
}
