'use strict';

require('should');
var request = require('supertest');

var AnyFetchProvider = require('../../lib/');
var Token = require('../../lib/models/token.js');
var helpers = require('./helpers');

var connectFunctions = helpers.connectFunctions;
var updateAccount = helpers.updateAccount;
var config = helpers.config;


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
