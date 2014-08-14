'use strict';

require('should');
var request = require('supertest');

var AnyFetchProvider = require('../../lib/');

var connectFunctions = {
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

var updateAccount = function updateAccount(serviceData, cursor, queues, cb) {
  cb(null, new Date());
};

var config = {
  appId: 'appId',
  appSecret: 'appSecret',

  providerUrl : 'https://your.provider.address'
};

// The server adds a listener for SIGTERM, with a lots of tests we can have more listeners than the default limit of 10 listeners
process.setMaxListeners(100);

describe('/ endpoint', function() {
  it("should redirect to anyfetch.com", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

    request(server).get('/')
      .expect(302)
      .expect('Location', 'http://anyfetch.com')
      .end(done);
  });
});
