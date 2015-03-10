'use strict';

require('should');
var request = require('supertest');
var AnyFetch = require('anyfetch');

var AnyFetchProvider = require('../../../lib/');
var TempToken = require('../../../lib/models/temp-token.js');
var helpers = require('../helpers');

var connectFunctions = helpers.connectFunctions;
var workersFile = helpers.workersFile;
var updateFile = helpers.updateFile;
var config = helpers.config;

describe("GET /init/callback endpoint", function() {
  var mockServer;
  before(function createMockServer(done) {
    mockServer = AnyFetch.createMockServer();

    var port = 1337;
    var apiUrl = 'http://localhost:' + port;

    mockServer.listen(port, function() {
      console.log('AnyFetch mock server running on ' + apiUrl);
      AnyFetch.setApiUrl(apiUrl);
      AnyFetch.setManagerUrl(apiUrl);

      done();
    });
  });

  after(function(done) {
    mockServer.close(done);
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
    var server = AnyFetchProvider.createServer(connectFunctions, workersFile, updateFile, config);

    request(server).get('/init/callback')
      .expect(302)
      .expect('Location', 'https://manager.anyfetch.com/connect?state=danger&message=Missing%20code%20cookie.')
      .end(done);
  });

  it("should manage error in accountName", function(done) {
    var retrieveTokens = function retrieveTokens(reqParams, storedParams, cb) {
      cb(null, 1, {
        'final': 'my-code'
      });
    };

    var callbackFunction = require('../../../lib/handlers/init/callback.js').getGenerator(retrieveTokens, config);

    var req = {
      ANYFETCH_SESSION: {
        code: tempToken.anyfetchCode
      }
    };

    var res = {
      send: function(statusCode, tmp, headers) {
        try {
          statusCode.should.eql(302);
          headers.should.have.property('location', tempToken.returnTo + "?state=danger&message=Error%3A%20Account%20name%20must%20be%20a%20string%2C%20sent%3A1");
        } catch(e) {
          return done(e);
        }

        done();
      }
    };

    callbackFunction(req, res, function() {});
  });

  it("should redirect user to returnTo URL with success state", function(done) {
    var callbackFunction = require('../../../lib/handlers/init/callback.js').getGenerator(connectFunctions.retrieveTokens, config);

    var req = {
      ANYFETCH_SESSION: {
        code: tempToken.anyfetchCode
      }
    };

    var res = {
      send: function(statusCode, tmp, headers) {
        try {
          statusCode.should.eql(302);
          headers.should.have.property('location', tempToken.returnTo + "?state=success");
        } catch(e) {
          return done(e);
        }

        done();
      }
    };

    callbackFunction(req, res, function() {});
  });
});
