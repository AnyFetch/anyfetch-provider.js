'use strict';

var logger = require('restify-logger');

logger.token('user', function(req) {
  return (req.token && req.token.accountName || '???') + ':';
});

logger.token('append', function(req, res) {
  if(res.statusCode >= 400) {
    return res._body;
  }
  return ' ';
});

module.exports = logger('custom', {
  skip: function(req) {
    return process.env.NODE_ENV === "test" || req.method === "OPTIONS";
  }
});
