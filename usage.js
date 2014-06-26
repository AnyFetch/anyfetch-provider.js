"use strict";
// Lib to interact with external services
var serviceLib = require('some-lib-for-my-service');

var AnyFetchProvider = require('anyfetch-provider');


var config = {
  // Anyfetch app id
  app_id: "you_app_id",

  // Anyfetch app secret
  app_secret: "you_app_id",
};

var connectFunctions = {
  // IN :
  //   * callback url to ping after grant
  // OUT :
  //   * err
  //   * url to redirect to
  //   * data to store (if any)
  redirectToService: function redirectToService(callbackUrl, cb) {
    serviceLib.generateRedirectUrl(function(err, redirectUrl) {
      redirectUrl += "&callback=" + encodeURI(callbackUrl);
      cb(null, redirectUrl, {
        token: '123'
      });
    });
  },

  // IN :
  //   * GET params from the incoming request,
  //   * Params returned by previous function
  // OUT :
  //   * err
  //   * service data to permanently store
  retrieveTokens: function retrieveTokens(reqParams, storedParams, cb) {
    serviceLib.generateAccessToken(reqParams.code, function(err, accessToken) {
      cb(null, {
        accessToken: accessToken,
        account: storedParams.account
      });
    });
  }
};

// IN :
//   * serviceData returned by retrieveTokens
//   * last cursor returned by this function, or null
//   * Queues to use
// OUT :
//   * err
//   * new cursor
//   * new serviceData to replace previous ones (if any)
var updateAccount = function updateAccount(serviceData, cursor, queues, cb) {
  serviceLib.retrieveDelta(cursor, function(err, createdFiles, deletedFiles) {
    createdFiles.forEach(function(task) {
      queues.additions.push(task);
    });

    deletedFiles.forEach(function(task) {
      queues.deletions.push(task);
    });

    cb();
  });
};

// IN :
//   * task to process
//   * pre-configured anyfetchClient
//   * serviceData returned by retrieveTokens
// OUT :
//   * err
var workers = {
  'additions': function(task, anyfetchClient, serviceData, cb) {
    anyfetchClient.sendDocument(task, cb);
  },
  'deletions': function(task, anyfetchClient, serviceData, cb) {
    anyfetchClient.deleteDocument(task, cb);
  }
};

// Set concurrency. Defaults to 5
workers.additions.concurrency = 5;


var server = AnyFetchProvider.createServer(config, connectFunctions, updateAccount, workers);

server.listen();
