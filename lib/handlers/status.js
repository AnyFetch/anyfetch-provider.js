'use strict';

var restify = require('restify');

var Token = require('../models/token.js');


/**
 * This handler display information about the token
 *
 * @param {Object} req Request object from the client
 * @param {Object} res Response we want to return
 * @param {Function} next Callback to call once res has been populated.
 */
module.exports = function(req, res, next) {
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

    res.send({
      anyfetch_token: token.anyfetchToken,
      datas: token.datas,
      cursor: token.cursor,
      is_updating: token.isUpdating,
      last_update: token.lastUpdate,
    });

    next();
  });
};
