'use strict';

require('should');
var request = require('supertest');

var AnyFetchProvider = require('../../lib/');
var helpers = require('./helpers');

var connectFunctions = helpers.connectFunctions;
var updateAccount = helpers.updateAccount;
var config = helpers.config;


describe('/ endpoint', function() {
  it("should redirect to anyfetch.com", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

    request(server).get('/')
      .expect(302)
      .expect('Location', 'http://anyfetch.com')
      .end(done);
  });
});
