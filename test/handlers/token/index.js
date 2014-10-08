'use strict';

require('should');
var request = require('supertest');
var async = require('async');
var rarity = require('rarity');

var AnyFetchProvider = require('../../../lib/');
var Token = require('../../../lib/models/token.js');
var helpers = require('../helpers');

var connectFunctions = helpers.connectFunctions;
var updateAccount = helpers.updateAccount;
var config = helpers.config;

describe('POST /token endpoint', function() {
  var token = {
    access_token: 'fake_token',
    data: {
      foo: 'bar'
    },
    cursor: new Date(),
    account_name: 'fake.test@anyfetch.com',
    last_update: new Date(2020, 2, 2),
    is_updating: true
  };

  before(AnyFetchProvider.debug.cleanTokens);

  it("should require access_token parameter", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

    request(server)
      .post('/token')
      .expect(409)
      .expect(/access_token/i)
      .end(done);
  });

  it("should save the new token", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

    async.waterfall([
      function sendToken(cb) {
        request(server)
          .post('/token')
          .send(token)
          .expect(204)
          .end(rarity.slice(1, cb));
      },
      function findToken(cb) {
        Token.findOne({anyfetchToken: token.access_token}, cb);
      },
      function checkToken(newToken, cb) {
        newToken.should.have.property('anyfetchToken', token.access_token);
        newToken.should.have.property('data', token.data);
        newToken.should.have.property('cursor', token.cursor.toISOString());
        newToken.should.have.property('accountName', token.account_name);
        newToken.should.have.property('lastUpdate', token.last_update);
        newToken.should.have.property('isUpdating', token.is_updating);

        cb(null);
      }
    ], done)
  });

  //Token.findOne({anyfetchToken: token.anyfetchToken}
});

describe('DELETE /token endpoint', function() {
  var token;
  before(AnyFetchProvider.debug.cleanTokens);
  before(function(done) {
    token = new Token({
      anyfetchToken: 'thetoken',
      data: {
        foo: 'bar'
      },
      accountName: 'test@anyfetch.com'
    });

    token.save(done);
  });

  it("should require access_token parameter", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

    request(server)
      .del('/token')
      .expect(409)
      .expect(/access_token/i)
      .end(done);
  });

  it("should send 404 on unknown token", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

    request(server)
      .del('/token?access_token=test')
      .expect(404)
      .expect(/unknown/i)
      .end(done);
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
            return done(err);
          }

          if(token) {
            return done(new Error("Token must be remove"));
          }

          done();
        });
      });
  });
});
