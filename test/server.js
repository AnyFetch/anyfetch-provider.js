'use strict';

var async = require('async');

var ProviderServer = require('../lib/cluestr-provider');

var accessGrant = "dqzknr54dzgd6f5";

var initAccount = function(req, res, next) {
  var preDatas = {
    accessGrant: accessGrant
  };
  next(null, preDatas);
};

var connectAccountRetrieveTempToken = function(req, res, TempToken, next) {
  // Retrieve temp token
  TempToken.findOne({'datas.accessGrant': accessGrant}, next);
};

var connectAccountRetrieveAuthDatas = function(req, res, preDatas, next) {
  var datas = preDatas.accessGrant + "_accessToken";
  next(null, datas);
};

var updateAccount = function(datas, next) {
  // Update the account !
  next();
};

var queueWorker = function(task, cb) {
  // Upload document
  cb();
};

describe("ProviderServer.createServer()", function() {
  it("should validate correct config", function(done) {
    var ret = ProviderServer.validateConfig({
      initAccount: initAccount,
      connectAccountRetrieveTempToken: connectAccountRetrieveTempToken,
      connectAccountRetrieveAuthDatas: connectAccountRetrieveAuthDatas,
      updateAccount: updateAccount,
      queueWorker: queueWorker,

      cluestrAppId: 'appId',
      cluestrAppSecret: 'appSecret',
      connectUrl: 'http://localhost:1337/init/connect'
    });
    if(ret) {
      throw new Error("No error should be returned");
    }

    done();
  });
});
