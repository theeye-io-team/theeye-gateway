'use strict';

const debug = require('debug');

function Logger (name) {
  var self = {};

  var dlog   = debug('theeye:log:' + name);
  var derror = debug('theeye:error:' + name);
  var ddata  = debug('theeye:data:' + name);
  var ddebug = debug('theeye:debug:' + name);
  var dwarn  = debug('theeye:warn:' + name);

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

module.exports =  Logger;
