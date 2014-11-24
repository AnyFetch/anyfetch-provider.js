'use strict';

require('should');
var request = require('supertest');

var AnyFetchProvider = require('../../../lib/');
var TempToken = require('../../../lib/models/temp-token.js');
var helpers = require('../helpers');

var connectFunctions = helpers.connectFunctions;
var workersFile = helpers.workersFile;
var updateFile = helpers.updateFile;
var config = helpers.config;

describe("GET /init/connect endpoint", function() {
  beforeEach(AnyFetchProvider.debug.cleanTokens);

  it("should require anyfetch code", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, workersFile, updateFile, config);

    request(server).get('/init/connect')
      .expect(409)
      .end(done);
  });

  it("should manage error in redirectUri", function(done) {
    var fakeConnectFunctions = {
      redirectToService: function redirectToService(callbackUrl, cb) {
        cb(null, 5);
      }
    };
    fakeConnectFunctions.retrieveTokens = connectFunctions.retrieveTokens;

    var server = AnyFetchProvider.createServer(fakeConnectFunctions, workersFile, updateFile, config);

    request(server).get('/init/connect?code=anyfetch_code')
      .expect(302)
      .expect('Location', 'https://manager.anyfetch.com/?state=danger&message=Error%3A%20Redirect%20url%20must%20be%20a%20string%2C%20sent%3A5')
      .end(done);
  });

  it("should store data returned by redirectToService() in TempToken", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, workersFile, updateFile, config);

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
