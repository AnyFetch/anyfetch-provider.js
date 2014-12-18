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
var util = require('../../util.js');
var redirectToReturnTo = util.redirectToReturnTo;


/**
 * This handler starts providing a new account onto AnyFetch.
 * We check the request is valid, create a new tempToken and call the handler for new account.
 * The tempToken is then saved.
 *
 * @param {Object} req Request object from the client
 * @param {Object} res Response we want to return
 * @param {Function} next Callback to call once res has been populated.
 */
module.exports.getGenerator = function getGenerator(redirectToService, config) {
  return function connectGet(req, res, next) {
    // Return_to parameter optionally indicates where we should re-send the user after the authentication
    // It is not the same thing as the callback URL, where the user is sent after giving the grant.
    var returnTo = req.params.return_to || process.env.MANAGER_URL || "https://manager.anyfetch.com";

    if(!req.params.code) {
      return next(new restify.MissingParameterError("Missing code parameter."));
    }

    async.waterfall([
      function callRedirectToService(cb) {
        redirectToService(config.providerUrl + '/init/callback', cb);
      },
      function removeTempToken(redirectUrl, preData, cb) {
        if(!cb) {
          cb = preData;
          preData = null;
        }

        // Remove previous token (may happen when trying to connect the same provider twice in a row)
        TempToken.remove({
          anyfetchCode: req.params.code
        }, rarity.carryAndSlice([redirectUrl, preData], 3, cb));
      },
      function saveTempToken(redirectUrl, preData, cb) {
        // Write the tempToken. We'll retrieve it later, in /init/callback.
        var tempToken = new TempToken({
          anyfetchCode: req.params.code,
          returnTo: returnTo,
          data: preData
        });

        tempToken.save(rarity.carryAndSlice([redirectUrl], 2, cb));
      },
      function redirectUser(redirectUrl, cb) {
        if(typeof redirectUrl !== "string") {
          return cb(new Error("Redirect url must be a string, sent:" + redirectUrl));
        }

        // Store current code in session, we'll use it later to retrieve our temp token.
        // This is not REST, but it makes our lives easier
        req.ANYFETCH_SESSION.code = req.params.code;
        res.send(302, null, {
          location: redirectUrl,
        });

        cb(null);
      }
    ], function(err) {
      if(err) {
        util.logError(err, req, {params: req.params, returnTo: returnTo});
        redirectToReturnTo(res, returnTo, {state: 'danger', message: err.toString()});
        return next();
      }

      next();
    });
  };
};
