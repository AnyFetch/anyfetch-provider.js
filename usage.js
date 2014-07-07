"use strict";
// Lib to interact with external services
var serviceLib = require('some-lib-for-my-service');

var AnyFetchProvider = require('anyfetch-provider');


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

    cb(null, new Date().toString());
  });
};

// IN :
//   * job, with preconfigured keys:
//     * task: data to process
//     * anyfetchClient: pre-configured client
//     * serviceData: as returned by retrieveTokens
// OUT :
//   * err
var workers = {
  'additions': function(job, cb) {
    job.anyfetchClient.sendDocument(job.task, cb);
  },
  'deletions': function(job, cb) {
    job.anyfetchClient.deleteDocument(job.task, cb);
  }
};

// Set concurrency. Defaults to 5 for non specified workers.
workers.additions.concurrency = 10;


var config = {
  // Anyfetch app id
  appId: "your_app_id",

  // Anyfetch app secret
  appSecret: "your_app_secret",
};

var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, workers, config);

server.listen();
