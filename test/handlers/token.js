'use strict';

require('should');
var request = require('supertest');

var AnyFetchProvider = require('../../lib/');
var Token = require('../../lib/models/token.js');
var helpers = require('./helpers');

var connectFunctions = helpers.connectFunctions;
var updateAccount = helpers.updateAccount;
var config = helpers.config;


describe('/token endpoint', function() {
  it("should require access_token parameter", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

    request(server)
      .del('/token')
      .expect(409)
      .expect(/access_token/i)
      .end(done);
  });

  it("should send 404 on unknow token", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

    request(server)
      .del('/token?access_token=test')
      .expect(404)
      .expect(/unknown/i)
      .end(done);
  });

  var token;
  before(AnyFetchProvider.debug.cleanTokens);
  before(function(done) {
    token = new Token({
      anyfetchToken: 'thetoken',
      data: {
        foo: 'bar'
      },
      accountName: 'accountName'
    });

    token.save(done);
  });

  it("should remove token", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

    request(server)
      .del('/token?access_token=thetoken')
      .expect(204)
      .end(function(err) {
        if(err) {
          return done(err);
        }

        Token.findOne({anyfetchToken: token.anyfetchToken}, function(err, token) {
          if(err) {
            done(err);
          }

          if(token) {
            done(new Error("Token must be remove"));
          }

          done();
        });
      });
  });
});
