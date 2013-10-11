'use strict';
/**
 * @file Define initial handlers,
 *
 * This retrieves access_token for both Google and Cluestr.
 *
 */

var dbox = require("dbox");
var async = require("async");
var Cluestr = require("cluestr");

var config = require('../../../config/configuration.js');
var TempToken = require('../models/temp-token.js');
var Token = require('../models/token.js');
var dbApp = dbox.app({
  "app_key": config.dropbox_id,
  "app_secret": config.dropbox_secret,
});


/**
 * This handler generates the appropriate URL and redirects the user to Dropbox consentment page.
 *
 * We require a GET `code` parameter (authorization code from Cluestr API)
 * We'll then transparently (302) redirect to Dropbox consentment page. When the user is OK, we'll be redirected back to /init/callback
 * For now, we won't do anything with the Cluestr authorization code: we'll simply save it in a temptoken for later retrieval.
 * 
 * @param {Object} req Request object from the client
 * @param {Object} res Response we want to return
 * @param {Function} next Callback to call once res has been populated.
 */
module.exports.connect = function (req, res, next) {
  if(!req.params.code) {
    return next(new Error("Missing code parameter."));
  }

  dbApp.requesttoken(function(status, requestToken) {
    var url = requestToken.authorize_url + "&oauth_callback=" + config.dropbox_callback;
    
    res.send(302, null, {
      Location: url
    });
    
    // Hold temporary state
    var tempToken = new TempToken({
      cluestrCode: req.params.code,
      dropboxTokens: requestToken
    });

    tempToken.save(function(err) {
      if(err) {
        return next(err);
      }

      next();
    });

  });

};

/**
 * The user is redirected to this handler after giving consent to Dropbox.
 *
 * Our previous request-token is now validated, and can be traded for an access_token.
 * 
 * @param {Object} req Request object from the client
 * @param {Object} res Response we want to return
 * @param {Function} next Callback to call once res has been populated.
 */
exports.callback = function (req, res, next) {
  async.waterfall([
    function(cb) {
      // Retrieve temp token
      var requestToken = req.params.oauth_token;
      TempToken.findOne({'dropboxTokens.oauth_token': requestToken}, cb);
    },
    function(tempToken, cb) {
      // Trade dropbox request token for access token
      dbApp.accesstoken(tempToken.dropboxTokens, function(status, dropboxAccessToken) {
        if(status !== 200) {
          return cb(new Error("Bad Dropbox status: " + status));
        }

        cb(null, tempToken, dropboxAccessToken);
      });
    },
    function(tempToken, dropboxAccessToken, cb) {
      // Trade cluestr authorization code for access token
      var cluestr = new Cluestr(config.cluestr_id, config.cluestr_secret);
      cluestr.getAccessToken(tempToken.cluestrCode, config.dropbox_connect, function(err, cluestrAccessToken) {
        cb(err, tempToken, cluestrAccessToken, dropboxAccessToken)
      });
    },
    function(tempToken, cluestrAccessToken, dropboxAccessToken, cb) {
      // Save for future access in MongoDB
      var token = new Token({
        cluestrToken: cluestrAccessToken,
        dropboxTokens: dropboxAccessToken
      });

      token.save(function(err) {
        cb(err, tempToken, token);
      });
    },
    function(tempToken, token, cb) {
      // Redirect to Cluestr page
      res.send(302, null, {
        Location: 'http://cluestr.com/'
      });

      // Start uploading now.
      require('../helpers/upload.js')(token, function(err) {
        if(err) {
          throw err;
        }
      });

      // Clean up now useless tempToken and continue.
      tempToken.remove(cb);
    }
  ], next);
};
