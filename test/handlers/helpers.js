'use strict';

module.exports.connectFunctions = {
  redirectToService: function redirectToService(callbackUrl, cb) {
    var preData = {
      "foo": "bar"
    };

    cb(null, 'http://localhost', preData);
  },

  retrieveTokens: function retrieveTokens(reqParams, storedParams, cb) {
    cb(null, 'test@anyfetch.com', {
      'final': 'my-code'
    });
  }
};

module.exports.workersFile = __dirname + '/helpers-workers.js';
module.exports.updateFile = __dirname + '/helpers-update.js';

module.exports.config = {
  appId: 'appId',
  appSecret: 'appSecret',

  providerUrl: 'https://your.provider.address'
};

// The server adds a listener for SIGTERM, with a lots of tests we can have more listeners than the default limit of 10 listeners
process.setMaxListeners(100);
