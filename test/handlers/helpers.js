'use strict';

module.exports.connectFunctions = {
  redirectToService: function redirectToService(callbackUrl, cb) {
    var preData = {
      "foo": "bar"
    };

    cb(null, 'http://localhost', preData);
  },

  retrieveTokens: function retrieveTokens(reqParams, storedParams, cb) {
    cb(null, 'accountName', {
      'final': 'my-code'
    });
  }
};

module.exports.updateAccount = function updateAccount(serviceData, cursor, queues, cb) {
  cb(null, new Date());
};

module.exports.config = {
  appId: 'appId',
  appSecret: 'appSecret',

  providerUrl : 'https://your.provider.address'
};

// The server adds a listener for SIGTERM, with a lots of tests we can have more listeners than the default limit of 10 listeners
process.setMaxListeners(100);
