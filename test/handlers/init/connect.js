'use strict';

require('should');
var request = require('supertest');

var AnyFetchProvider = require('../../../lib/');
var TempToken = require('../../../lib/models/temp-token.js');

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


describe("/init/connect endpoint", function() {
  beforeEach(AnyFetchProvider.debug.cleanTokens);

  it("should require anyfetch code", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

    request(server).get('/init/connect')
      .expect(409)
      .end(done);
  });

  it("should store data returned by redirectToService() in TempToken", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

    request(server).get('/init/connect?code=anyfetch_code')
      .expect(302)
      .end(function(err) {
        if(err) {
          throw err;
        }

        TempToken.findOne({'data.foo': 'bar'}, function(err, tempToken) {
          if(err) {
            return done(err);
          }

          tempToken.should.have.property('anyfetchCode', 'anyfetch_code');

          done();
        });

      });
  });
});
