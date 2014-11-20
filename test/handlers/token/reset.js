'use strict';

require('should');
var request = require('supertest');

var AnyFetchProvider = require('../../../lib/');
var Token = require('../../../lib/models/token.js');
var helpers = require('../helpers');

var connectFunctions = helpers.connectFunctions;
var workersFile = helpers.workersFile;
var updateFile = helpers.updateFile;
var config = helpers.config;

describe("DELETE /token/reset endpoint", function() {
  before(AnyFetchProvider.debug.cleanTokens);
  before(function(done) {
    // Create a token, as-if /init/ workflow was properly done
    var token = new Token({
      anyfetchToken: 'thetoken',
      data: {
        foo: 'bar'
      },
      cursor: 'current-cursor',
      accountName: 'test@anyfetch.com'
    });

    token.save(done);
  });


  it("should require access_token to reset", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, workersFile, updateFile, config);

    request(server)
      .del('/token/reset')
      .expect(409)
      .end(done);
  });

  it("should require valid access_token to reset", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, workersFile, updateFile, config);

    request(server)
      .del('/token/reset')
      .send({
        access_token: 'dummy_access_token'
      })
      .expect(404)
      .end(done);
  });


  it("should reset account", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, workersFile, updateFile, config);

    request(server)
      .del('/token/reset')
      .send({
        access_token: 'thetoken'
      })
      .expect(204)
      .end(function(err) {
        if(err) {
          throw err;
        }

        Token.findOne({anyfetchToken: 'thetoken'}, function(err, token) {
          if(err) {
            throw err;
          }

          token.should.have.property('cursor', null);

          done();
        });
      });
  });
});
