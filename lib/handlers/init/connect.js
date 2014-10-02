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
        TempToken.remove({anyfetchCode: req.params.code}, rarity.carryAndSlice([redirectUrl, preData], 3, cb));
      },
      function saveTempToken(redirectUrl, preData, cb) {
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

        req.ANYFETCH_SESSION.code = req.params.code;
        res.send(302, null, {
          location: redirectUrl,
        });

        cb(null);
      }
    ], function(err) {
      if(err) {
        util.logError(err, {params: req.params, returnTo: returnTo});
        redirectToReturnTo(res, returnTo, {state: 'danger', message: err.toString()});
        return next();
      }
      
      next();
    });
  };
};