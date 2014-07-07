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
var rarity = require('rarity');

var TempToken = require('../../models/temp-token.js');
var Token = require('../../models/token.js');

/**
 * The user is redirected to this handler after getting access to his provider.
 *
 * @param {Object} req Request object from the client
 * @param {Object} res Response we want to return
 * @param {Function} next Callback to call once res has been populated.
 */
module.exports = function(retrieveTokens, config) {
  return function(req, res, next) {
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
        retrieveTokens(req.params, tempToken.data, rarity.carry([tempToken], cb));
      },
      function createAccessToken(tempToken, accountName, providerData, cb) {
        // Create a new anyfetch access-token with our grant
        Anyfetch.getAccessToken(config.appId, config.appSecret, tempToken.anyfetchCode, rarity.carry([accountName, providerData, tempToken], cb));
      },
      function createNewToken(accountName, providerData, tempToken, anyfetchAccessToken, cb) {
        // Create new token
        var token = new Token({
          anyfetchToken: anyfetchAccessToken,
          data: providerData,
          accountName: accountName
        });

        token.save(rarity.carryAndSlice([tempToken, tempToken.returnTo], 3, cb));
      },
      function removeTempToken(tempToken, returnTo, cb) {
        tempToken.remove(rarity.carry([returnTo], cb));
      }
    ], function sendResponse(err, returnTo) {
      if(err) {
        return next(err);
      }

      res.send(302, null, {
        location: returnTo
      });

      next();
    });
  };
};
