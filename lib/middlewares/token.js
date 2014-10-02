'use strict';

var async = require('async');
var restify = require('restify');

var Token = require('../models/token.js');

module.exports = function(req, res, next) {
  if(!req.params.access_token) {
    return next();
  }

  async.waterfall([
    function retrieveToken(cb) {
      Token.findOne({anyfetchToken: req.params.access_token}, cb);
    },
    function setToken(token, cb) {
      if(!token) {
        return cb(new restify.ResourceNotFoundError("Unknown token."));
      }

      req.token = token;
      cb(null);
    }
  ], next);
};
