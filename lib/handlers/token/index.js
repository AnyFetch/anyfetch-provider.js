'use strict';

var restify = require('restify');
var async = require('async');

module.exports.del = function tokenDel(req, res, next) {
  if(!req.params.access_token) {
    return next(new restify.MissingParameterError("Missing access_token parameter."));
  }

  var server = require('../../index.js').createServer.current;

  async.waterfall([
    function removeToken(cb) {
      if(server) {
        server.tokenCache.del(req.token.anyfetchToken);
      }

      req.token.remove(cb);
    },
    function sendResponse(token, cb) {
      res.send(204);
      cb(null);
    }
  ], next);
};
