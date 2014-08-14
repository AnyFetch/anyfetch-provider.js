'use strict';

require('should');
var request = require('supertest');

var AnyFetchProvider = require('../../lib/');
var TempToken = require('../../lib/models/temp-token.js');
var helpers = require('./helpers');

var connectFunctions = helpers.connectFunctions;
var updateAccount = helpers.updateAccount;
var config = helpers.config;


describe("/init endpoints", function() {
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
