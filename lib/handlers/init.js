'use strict';
/**
 * @file Define initial handlers,
 *
 * Trade grant_tokens for access_tokens.
 *
 */
var Anyfetch = require('anyfetch');
var async = require('async');
var restify = require('restify');

var TempToken = require('../models/temp-token.js');
var Token = require('../models/token.js');

/**
 * This handler starts providing a new account onto AnyFetch.
 * We check the request is valid, create a new tempToken and call the handler for new account.
 * The tempToken is then saved.
 *
 * @param {Object} req Request object from the client
 * @param {Object} res Response we want to return
 * @param {Function} next Callback to call once res has been populated.
 */
module.exports.connect = function(redirectToService, config) {
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

/**
 * The user is redirected to this handler after getting access to his provider.
 *
 * @param {Object} req Request object from the client
 * @param {Object} res Response we want to return
 * @param {Function} next Callback to call once res has been populated.
 */
exports.callback = function(retrieveTokens, config) {
  return function (req, res, next) {
    if(!req.params.code) {
      return next(new restify.MissingParameterError("Missing code parameter."));
    }

    async.waterfall([
      function retrieveTempToken(cb) {
        TempToken.findOne({anyfetchCode: req.params.code}, cb);
      },
      function retrieveDataFromProvider(tempToken, cb) {
        if(!tempToken) {
          return cb(new Error("Unable to retrieve provider preData."));
        }

        // Retrieve data from provider
        retrieveTokens(req.params, tempToken.data, function(err, accountName, providerData) {
          cb(err, tempToken, accountName, providerData);
        });
      },
      function createAccessToken(tempToken, accountName, providerData, cb) {
        // Create a new anyfetch access-token with our grant
        Anyfetch.getAccessToken(config.app_id, config.app_secret, tempToken.anyfetchCode, function(err, anyfetchAccessToken) {
          cb(err, tempToken, accountName, anyfetchAccessToken, providerData);
        });
      },
      function createNewToken(tempToken, accountName, anyfetchAccessToken, providerData, cb) {
        // Create new token
        var token = new Token({
          anyfetchToken: anyfetchAccessToken,
          data: providerData,
          accountName: accountName
        });

        token.save(function(err) {
          cb(err, tempToken, tempToken.returnTo);
        });
      },
      function removeTempToken(tempToken, returnTo, cb) {
        tempToken.remove(function(err) {
          cb(err, returnTo);
        });
      }
    ], function sendResponse(err, returnTo) {
      if(err) {
        return next(err);
      }

      res.send(302, null, {
        Location: returnTo
      });

      next();
    });
  };
};
