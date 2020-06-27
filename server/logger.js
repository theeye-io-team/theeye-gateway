
const debug = require('debug')
const os = require('os')

function Logger (name) {
  const self = {}

  let message = `theeye:%LEVEL%:${name}`
  if (process.env.THEEYE_NODE_HOSTNAME) {
    message = `${process.env.THEEYE_NODE_HOSTNAME} ${message}`
  }

  const ddata  = debug(message.replace('%LEVEL%','data'))
  const ddebug = debug(message.replace('%LEVEL%','debug'))
  const dlog   = debug(message.replace('%LEVEL%','log'))
  const dwarn  = debug(message.replace('%LEVEL%','warn'))
  const derror = debug(message.replace('%LEVEL%','error'))

  self.log = function flog(){
    dlog.apply(self, arguments)
  }

  self.error = function ferror(){
    derror.apply(self, arguments)
  }

  self.warn = function fwarn(){
    dwarn.apply(self, arguments)
  }

  self.data = function fdata(){
    ddata.apply(self, arguments)
  }

  self.debug = function fdebug(){
    ddebug.apply(self, arguments)
  }

  self.instance = debug

  return self
}

module.exports = Logger
