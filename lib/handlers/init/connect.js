'use strict';
/**
 * @file Define initial handlers,
 *
 * Trade grant_tokens for access_tokens.
 *
 */
var restify = require('restify');

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
  return function (req, res, next) {
    if(!req.params.code) {
      return next(new restify.MissingParameterError("Missing code parameter."));
    }

    // Hold temporary state
    var tempToken = new TempToken({
      anyfetchCode: req.params.code,
      returnTo: (req.params.returnTo) ? req.params.returnTo : "https://manager.anyfetch.com"
    });

    redirectToService(config.providerUrl + '/init/callback?code=' + req.params.code, function(err, redirectUrl, preData) {
      if(err) {
        return next(err);
      }

      tempToken.data = preData;
      tempToken.save(function(err) {
        if(err) {
          return next(err);
        }

        res.send(302, null, {
          Location: redirectUrl
        });
        next();
      });
    });
  };
};