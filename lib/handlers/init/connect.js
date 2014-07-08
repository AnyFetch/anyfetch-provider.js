'use strict';
/**
 * @file Define initial handlers,
 *
 * Trade grant_tokens for access_tokens.
 *
 */
var restify = require('restify');
var async = require('async');
var rarity = require('rarity');

var TempToken = require('../../models/temp-token.js');

/**
 * This handler starts providing a new account onto AnyFetch.
 * We check the request is valid, create a new tempToken and call the handler for new account.
 * The tempToken is then saved.
 *
 * @param {Object} req Request object from the client
 * @param {Object} res Response we want to return
 * @param {Function} next Callback to call once res has been populated.
 */
module.exports = function(redirectToService, config) {
  return function(req, res, next) {
    if(!req.params.code) {
      return next(new restify.MissingParameterError("Missing code parameter."));
    }

    async.waterfall([
      function callRedirectToService(cb) {
        redirectToService(config.providerUrl + '/init/callback?code=' + req.params.code, cb);
      },
      function saveTempToken(redirectUrl, preData, cb) {
        var tempToken = new TempToken({
          anyfetchCode: req.params.code,
          returnTo: req.params.return_to || "https://manager.anyfetch.com",
          data: preData
        });

        tempToken.save(rarity.carry([redirectUrl], cb));
      },
      function redirectUser(redirectUrl, cb) {
        res.send(302, null, {
          location: redirectUrl
        });

        cb(null);
      }
    ], next);
  };
};