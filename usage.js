"use strict";
var serviceLib = {};


var config = {
  app_id: "you_app_id",
  app_secret: "you_app_id",
};

var connectFunctions = {
  // IN :
  //   * callback url to ping after grant
  // OUT :
  //   * err
  //   * url to redirect to
  //   * data to store (if any)
  redirectToService: function redirectToService(callbackUrl, next) {
    serviceLib.generateRedirectUrl(function(err, redirectUrl) {
      redirectUrl += "&callback=" + encodeURI(callbackUrl);
      next(null, redirectUrl, {
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
  retrieveTokens: function retrieveTokens(reqParams, storedParams, next) {
    serviceLib.generateAccessToken(reqParams.code, function(err, accessToken) {
      next(null, {
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
var updateAccount = function updateAccount(serviceData, cursor, queues, next) {
  serviceLib.retrieveDelta(cursor, function(err, createdFiles, deletedFiles) {
    createdFiles.forEach(function(task) {
      queues.additions.push(task);
    });

    deletedFiles.forEach(function(task) {
      queues.deletions.push(task);
    });

    next();
  });
};

// IN :
//   * task to process
//   * pre-configured anyfetchClient
//   * serviceData returned by retrieveTokens
// OUT :
//   * err
var workers = {
  'additions': function(task, anyfetchClient, serviceData, next) {
    anyfetchClient.sendDocument(task, next);
  },
  'deletions': function(task, anyfetchClient, serviceData, next) {
    anyfetchClient.deleteDocument(task, next);
  }
};


var server = AnyFetchProvider.createServer(config, connectFunctions, updateAccount, workers);

server.listen();
