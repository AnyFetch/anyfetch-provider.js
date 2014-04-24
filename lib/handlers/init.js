'use strict';
/**
 * @file Define initial handlers,
 *
 * Trade grant_tokens for access_tokens.
 *
 */
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
module.exports.connect = function(initAccountCb) {
  return function (req, res, next) {
    if(!req.params.code) {
      return next(new restify.MissingParameterError("Missing code parameter."));
    }

    // Hold temporary state
    var tempToken = new TempToken({
      anyfetchCode: req.params.code,
    });

    initAccountCb(req, function(err, preDatas, redirectUrl) {
      if(err) {
        return next(err);
      }

      tempToken.datas = preDatas;
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
exports.callback = function(connectAccountRetrievePreDatasIdentifier, connectAccountRetrieveAuthDatas, anyfetchClient, connectUrl, redirectUrl) {
  return function (req, res, next) {
    async.waterfall([
      function(cb) {
        // Retrieve the previous tempToken
        connectAccountRetrievePreDatasIdentifier(req, cb);
      },
      function(hash, cb) {
        TempToken.findOne(hash, cb);
      },
      function(tempToken, cb) {
        if(!tempToken) {
          return cb(new Error("Unable to retrieve provider preDatas."));
        }

        // Retrieve datas from provider
        connectAccountRetrieveAuthDatas(req, tempToken.datas, function(err, providerDatas) {
          cb(err, tempToken, providerDatas);
        });
      },
      function(tempToken, providerDatas, cb) {
        // Create a new anyfetch access-token with our grant
        anyfetchClient.getAccessToken(tempToken.anyfetchCode, connectUrl, function(err, anyfetchAccessToken) {
          cb(err, tempToken, anyfetchAccessToken, providerDatas);
        });
      },
      function(tempToken, anyfetchAccessToken, providerDatas, cb) {
        // Create new token
        var token = new Token({
          anyfetchToken: anyfetchAccessToken,
          datas: providerDatas
        });

        token.save(function(err) {
          cb(err, tempToken);
        });
      },
      function(tempToken, cb) {
        tempToken.remove(cb);
      }
    ], function(err) {
      if(err) {
        return next(err);
      }
      
      res.send(302, null, {
        Location: redirectUrl
      });

      next();
    });
  };
};