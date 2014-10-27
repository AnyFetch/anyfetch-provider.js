'use strict';
/**
 * @file Define initial handlers,
 *
 * Trade grant_tokens for access_tokens.
 *
 */
var Anyfetch = require('anyfetch');
var async = require('async');
var rarity = require('rarity');

var CancelError = require('../../index.js').CancelError;
var TempToken = require('../../models/temp-token.js');
var Token = require('../../models/token.js');
var util = require('../../util.js');
var redirectToReturnTo = util.redirectToReturnTo;

/**
 * The user is redirected to this handler after getting access to his provider.
 *
 * @param {Object} req Request object from the client
 * @param {Object} res Response we want to return
 * @param {Function} next Callback to call once res has been populated.
 */
module.exports.getGenerator = function getGenerator(retrieveTokens, config) {
  return function callbackGet(req, res, next) {
    var returnTo = process.env.MANAGER_URL || "https://manager.anyfetch.com";
    returnTo += '/connect';

    if(!req.ANYFETCH_SESSION.code) {
      console.warn("ERR: Missing code cookie.");
      redirectToReturnTo(res, returnTo, {state: 'danger', message: "Missing code cookie."});
      return next();
    }

    async.waterfall([
      function retrieveTempToken(cb) {
        TempToken.findOne({anyfetchCode: req.ANYFETCH_SESSION.code}, cb);
      },
      function retrieveDataFromProvider(tempToken, cb) {
        if(!tempToken) {
          return cb(new Error("Unable to retrieve provider preData."));
        }

        returnTo = tempToken.returnTo;

        // Retrieve data from provider
        retrieveTokens(req.params, tempToken.data, rarity.carry([tempToken], cb));
      },
      function createAccessToken(tempToken, accountName, providerData, cb) {
        if(typeof accountName !== "string") {
          return cb(new Error("Account name must be a string, sent:" + accountName));
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

        token.save(rarity.carryAndSlice([anyfetchAccessToken, tempToken], 3, cb));
      },
      function removeTempToken(anyfetchAccessToken, tempToken, cb) {
        tempToken.remove(rarity.carryAndSlice([anyfetchAccessToken], 2, cb));
      },
      function updateCompany(anyfetchAccessToken, cb) {
        var anyfetchClient = new Anyfetch(anyfetchAccessToken);
        anyfetchClient.postCompanyUpdate(cb);
      }
    ], function sendResponse(err) {
      if(err && !(err instanceof CancelError)) {
        util.logError(err, req, {params: req.params, returnTo: returnTo, code: req.ANYFETCH_SESSION.code});
        redirectToReturnTo(res, returnTo, {state: 'danger', message: err.toString()});
        return next();
      }

      redirectToReturnTo(res, returnTo, {state: (err instanceof CancelError) ? 'canceled' : 'success'});
      next();
    });
  };
};
