'use strict';

var async = require('async');

var accessGrant = "dqzknr54dzgd6f5";

var initAccount = function(req, res, next) {
  var preDatas = {
    accessGrant: accessGrant
  };
  next(null, preDatas);
};

var connectAccountRetrieveTempToken = function(req, res, TempToken, next) {
  // Retrieve temp token
  TempToken.findOne({'datas.accessGrant': accessGrant}, cb);
};

var connectAccountRetrieveAuthDatas = function(req, res, preDatas, next) {
  var datas = preDatas.accessGrant + "_accessToken";
  next();
};

var updateAccount = function(datas, next) {
  // Update the account !
};
