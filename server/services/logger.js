
const debug = require('debug')

const Logger = (name) => {
  const self = {};
  const dlog   = debug('theeye:log:' + name);
  const derror = debug('theeye:error:' + name);
  const ddata  = debug('theeye:data:' + name);
  const ddebug = debug('theeye:debug:' + name);
  const dwarn  = debug('theeye:warn:' + name);

  self.log = function flog(){
    dlog.apply(self, arguments);
  };

  self.error = function ferror(){
    derror.apply(self, arguments);
  };

  self.warn = function fwarn(){
    dwarn.apply(self, arguments);
  };

  self.data = function fdata(){
    ddata.apply(self, arguments);
  };

  self.debug = function fdebug(){
    ddebug.apply(self, arguments);
  };

  return self;
}

module.exports =  Logger
