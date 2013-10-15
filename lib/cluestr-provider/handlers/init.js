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
 * This handler starts a new account for Cluestr.
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
      cluestrCode: req.params.code,
    });

    initAccountCb(req, res, function(err, preDatas) {
      if(err) {
        return next(err);
      }

      tempToken.datas = preDatas;
      tempToken.save(function(err) {
        if(err) {
          return next(err);
        }

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
exports.callback = function(connectAccountRetrieveTempToken, connectAccountRetrieveAuthDatas, cluestrClient, connectUrl) {
  return function (req, res, next) {
    async.waterfall([
      function(cb) {
        // Retrieve the previous tempToken
        connectAccountRetrieveTempToken(req, res, cb);
      },
      function(tempToken, cb) {
        if(!tempToken) {
          return cb(new Error("Unable to retrieve provider preDatas."));
        }

        // Create a new cluestr access-token with our grant
        cluestrClient.getAccessToken(tempToken.cluestrCode, connectUrl, function(err, cluestrAccessToken) {
          cb(err, tempToken, cluestrAccessToken);
        });
      },
      function(tempToken, cluestrAccessToken, cb) {
        // Retrieve datas from provider
        connectAccountRetrieveAuthDatas(req, res, tempToken.datas, function(err, providerDatas) {
          cb(err, tempToken, cluestrAccessToken, providerDatas);
        });
      },
      function(tempToken, cluestrAccessToken, providerDatas, cb) {
        // Create new token
        var token = new Token({
          cluestrToken: cluestrAccessToken,
          datas: providerDatas
        });

        token.save(function(err) {
          cb(err, tempToken, token);
        });
      },
      function(tempToken, token, cb) {
        tempToken.remove(function(err) {
          cb(err, token);
        });
      }
    ], function(err, token) {
      if(err) {
        return next(err);
      }

      next();
    });
  };
};
