'use strict';

require('should');
var request = require('supertest');

var AnyFetchProvider = require('../../lib/');
var helpers = require('./helpers');

var connectFunctions = helpers.connectFunctions;
var workers = helpers.workers;
var workersFile = helpers.workersFile;
var updateFile = helpers.updateFile;
var config = helpers.config;

describe('GET / endpoint', function() {
  it("should redirect to anyfetch.com", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, workers, workersFile, updateFile, config);

    request(server).get('/')
      .expect(302)
      .expect('Location', 'http://anyfetch.com')
      .end(done);
  });
});
