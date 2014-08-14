'use strict';

require('should');
var request = require('supertest');
var AnyFetch = require('anyfetch');

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


describe("/init endpoints", function() {
  before(function createMockServer(done) {
    var server = AnyFetch.createMockServer();

    var port = 1337;
    var apiUrl = 'http://localhost:' + port;

    server.listen(port, function() {
      console.log('AnyFetch mock server running on ' + apiUrl);
      AnyFetch.setApiUrl(apiUrl);
      AnyFetch.setManagerUrl(apiUrl);

      done();
    });
  });

  beforeEach(AnyFetchProvider.debug.cleanTokens);

  var tempToken;
  beforeEach(function(done) {
    // Create a token, as-if /init/ workflow was properly done
    tempToken = new TempToken({
      anyfetchCode: 'fakeCode',
      data: {},
      returnTo: 'returnToUrl'
    });

    tempToken.save(done);
  });

  it("should require code session", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

    request(server).get('/init/connect')
      .expect(409)
      .end(done);
  });

  it("should redirect user to returnTo URL with success state", function(done) {
    var callbackFunction = require('../../../lib/handlers/init/callback.js')(connectFunctions.retrieveTokens, config);

    var req = {
      ANYFETCH_SESSION: {
        code: tempToken.anyfetchCode
      }
    };

    var res = {
      send: function(statusCode, tmp, headers) {
        statusCode.should.eql(302);
        headers.should.have.property('location', tempToken.returnTo + "?state=success");

        done();
      }
    };

    callbackFunction(req, res, function() {});
  });
});
