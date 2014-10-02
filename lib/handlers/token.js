'use strict';

var restify = require('restify');
var rarity = require('rarity');
var async = require('async');

var Token = require('../models/token.js');

module.exports = function(req, res, next) {
  if(!req.params.access_token) {
    return next(new restify.MissingParameterError("Missing access_token parameter."));
  }

  async.waterfall([
    function retrieveToken(cb) {
      Token.findOne({anyfetchToken: req.params.access_token}, cb);
    },
    function removeToken(token, cb) {
      if(!token) {
        return cb(new restify.ResourceNotFoundError("Unknown token."));
      }

      token.remove(cb);
    },
    function sendResponse(token, cb) {
      res.send(204);
      cb(null);
    }
  ], next);
};
