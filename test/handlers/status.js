'use strict';

require('should');
var request = require('supertest');

var AnyFetchProvider = require('../../lib/');
var Token = require('../../lib/models/token.js');

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


describe("/status endpoint", function() {
  var token;
  before(AnyFetchProvider.debug.cleanTokens);
  before(function(done) {
    // Create a token, as-if /init/ workflow was properly done
    token = new Token({
      anyfetchToken: 'thetoken',
      data: {
        foo: 'bar'
      },
      cursor: 'current-cursor'
    });

    token.save(done);
  });


  it("should require an access_token", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

    request(server)
      .get('/status')
      .expect(409)
      .end(done);
  });

  it("should require valid access_token", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

    request(server)
      .get('/status')
      .query({
        access_token: 'dummy_access_token'
      })
      .expect(409)
      .end(done);
  });


  it("should display informations", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

    request(server)
      .get('/status')
      .query({
        access_token: token.anyfetchToken
      })
      .expect(200)
      .expect(function(res) {
        res.body.should.have.keys(['anyfetch_token', 'data', 'cursor', 'is_updating', 'last_update']);
      })
      .end(done);
  });
});
