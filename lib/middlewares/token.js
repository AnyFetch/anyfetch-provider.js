'use strict';

var async = require('async');
var restify = require('restify');

var Token = require('../models/token.js');


/**
 * Ensure the request contains a valid token.
 *
 * Save the token for later use on req.token
 */
module.exports = function(req, res, next) {
  if(!req.params.access_token) {
    return next(new restify.MissingParameterError("Missing access_token parameter."));
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
