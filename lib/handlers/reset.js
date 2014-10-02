'use strict';
/**
 * @file Update an account from specified access_token
 *
 */

var restify = require('restify');

var Token = require('../models/token.js');


/**
 * This handler resets the token.
 * Next call to /update will start uploading everything anew.
 * 
 * @param {Object} req Request object from the client
 * @param {Object} res Response we want to return
 * @param {Function} next Callback to call once res has been populated.
 */
module.exports.del = function(req, res, next) {
  if(!req.params.access_token) {
    return next(new restify.MissingParameterError("Missing access_token parameter."));
  }

  Token.findOne({anyfetchToken: req.params.access_token}, function(err, token) {
    if(err) {
      return next(err);
    }
    if(!token) {
      return next(new restify.MissingParameterError("Unknown token."));
    }

    token.cursor = null;
    token.isUpdating = false;
    token.lastUpdate = null;

    res.send(204);
    token.save(next);
  });
};
