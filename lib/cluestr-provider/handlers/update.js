'use strict';
/**
 * @file Update an account from specified access_token
 *
 */

var restify = require('restify');

var Token = require('../models/token.js');
var upload = require('../helpers/upload.js');


/**
 * This handler downloads datas for the specified access_token and starts uploading them onto Cluestr.
 * 
 * @param {Object} req Request object from the client
 * @param {Object} res Response we want to return
 * @param {Function} next Callback to call once res has been populated.
 */
module.exports = function(req, res, next) {
  if(!req.params.access_token) {
    return next(new restify.ForbiddenError("Missing access_token parameter."));
  }

  Token.findOne({cluestrToken: req.params.access_token}, function(err, token) {
    if(err) {
      return next(err);
    }
    if(!token) {
      return next(new Error("Unknown token."));
    }

    res.send(204);
    next();

    upload(token, function(err) {
      if(err) {
        throw err;
      }
    });
  });
};
