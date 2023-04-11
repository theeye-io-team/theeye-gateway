const os = require('os')
const exec = require('child_process').exec
const express = require('express')
const logger = require('../logger')('router:status')

module.exports = (app) => {
  const router = express.Router()

  router.get('/', nodeStatus)

  router.get('/data', (req, res, next) => {
    const data = [
      { id: 1, value:  1 },
      { id: 2, value:  2 },
      { id: 3, value:  3 },
      { id: 4, value:  4 },
      { id: 5, value:  5 },
      { id: 6, value:  6 },
      { id: 7, value:  7 },
      { id: 8, value:  8 },
      { id: 9, value:  9 },
      { id: 10, value: 10 },
      { id: 11, value: 11 },
      { id: 12, value: 12 },
      { id: 13, value: 13 },
      { id: 15, value: 15 },
      { id: 16, value: 16 },
    ]

    if (req.query.q) {
      res.json(
        data.filter(d => new RegExp(req.query.q).test(d.value) === true)
      )
    }
    res.json(data)
  })

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
