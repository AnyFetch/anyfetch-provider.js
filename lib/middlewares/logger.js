'use strict';

var logger = require('morgan');

var customLogger = function(tokens, req, res) {
  // Don't log on test
  if(process.env.NODE_ENV === "test") {
    return;
  }

  // Don't log OPTIONS call, CORS.
  if(req.method === "OPTIONS") {
    return;
  }

  var status = res.statusCode;
  var color = 32;
  var error = "";
  if(status >= 500) {
    color = 31;
    error = res._body;
  }
  else if(status >= 400){
    color = 33;
    error = res._body;
  }
  else if(status >= 300) {
    color = 36;
  }

  var account_name;
  if(req.token && req.token.accountName) {
    account_name = req.token.accountName;
  }
  else {
    account_name = "???";
  }

  return '\x1b[90m' + req.method + ' ' + account_name + ":" + req.url + ' ' + '\x1b[' + color + 'm' + res.statusCode + ' \x1b[90m' + (new Date() - req._startTime) + 'ms' + '\x1b[0m' + ' ' + error;

};


module.exports = logger(customLogger);
module.exports.customLogger = customLogger;
