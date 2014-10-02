'use strict';
/**
 * @file Update an account from specified access_token
 *
 */

var restify = require('restify');


/**
 * This handler resets the token.
 * Next call to /update will start uploading everything anew.
 * 
 * @param {Object} req Request object from the client
 * @param {Object} res Response we want to return
 * @param {Function} next Callback to call once res has been populated.
 */
module.exports.del = function resetDel(req, res, next) {
  if(!req.params.access_token) {
    return next(new restify.MissingParameterError("Missing access_token parameter."));
  }

  req.token.cursor = null;
  req.token.isUpdating = false;
  req.token.lastUpdate = null;

  res.send(204);
  req.token.save(next);
};
