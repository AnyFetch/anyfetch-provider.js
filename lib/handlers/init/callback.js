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
var url = require('url');

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
    if(!req.ANYFETCH_SESSION.code) {
      console.warn("ERR: Missing code cookie.");
      return next(new restify.MissingParameterError("Missing code cookie."));
    }

    async.waterfall([
      function retrieveTempToken(cb) {
        TempToken.findOne({anyfetchCode: req.ANYFETCH_SESSION.code}, cb);
      },
      function retrieveDataFromProvider(tempToken, cb) {
        if(!tempToken) {
          return cb(new Error("Unable to retrieve provider preData."));
        }

        // Retrieve data from provider
        retrieveTokens(req.params, tempToken.data, rarity.carry([tempToken], cb));
      },
      function createAccessToken(tempToken, accountName, providerData, cb) {
        if(typeof accountName !== "string") {
          console.warn("Error: String attempt as accountName");
        }

        // Create a new anyfetch access-token with our grant
        Anyfetch.getAccessToken(config.appId, config.appSecret, tempToken.anyfetchCode, rarity.carry([accountName, providerData, tempToken], cb));
      },
      function setAccountName(accountName, providerData, tempToken, anyfetchAccessToken, cb) {
        var anyfetchClient = new Anyfetch(anyfetchAccessToken);
        anyfetchClient.postAccountName(accountName, rarity.carryAndSlice([accountName, providerData, tempToken, anyfetchAccessToken], 5, cb));
      },
      function createNewToken(accountName, providerData, tempToken, anyfetchAccessToken, cb) {
        // Create new token
        var token = new Token({
          anyfetchToken: anyfetchAccessToken,
          data: providerData,
          accountName: accountName
        });

        token.save(rarity.carryAndSlice([anyfetchAccessToken, tempToken, tempToken.returnTo], 4, cb));
      },
      function removeTempToken(anyfetchAccessToken, tempToken, returnTo, cb) {
        tempToken.remove(rarity.carryAndSlice([anyfetchAccessToken, returnTo], 3, cb));
      },
      function updateCompany(anyfetchAccessToken, returnTo, cb) {
        var anyfetchClient = new Anyfetch(anyfetchAccessToken);
        anyfetchClient.postCompanyUpdate(rarity.carry([returnTo], cb));
      }
    ], function sendResponse(err, returnTo) {
      if(err && !err.toString().match(/canceled/i)) {
        console.warn("ERR:", err);
        res.send(500);
        return next(err);
      }

      var urlObj = url.parse(returnTo);
      urlObj.query.state = (err) ? 'canceled' : 'success';
      returnTo = url.format(urlObj);

      res.send(302, null, {
        location: returnTo
      });

      next();
    });
  };
};
