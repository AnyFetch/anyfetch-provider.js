'use strict';

require('should');
var request = require('supertest');

var AnyFetchProvider = require('../../lib/');
var Token = require('../../lib/models/token.js');

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


describe("/reset endpoint", function() {
  before(AnyFetchProvider.debug.cleanTokens);
  before(function(done) {
    // Create a token, as-if /init/ workflow was properly done
    var token = new Token({
      anyfetchToken: 'thetoken',
      data: {
        foo: 'bar'
      },
      cursor: 'current-cursor'
    });

    token.save(done);
  });


  it("should require access_token to reset", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

    request(server)
      .del('/reset')
      .expect(409)
      .end(done);
  });

  it("should require valid access_token to reset", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

    request(server)
      .del('/reset')
      .send({
        access_token: 'dummy_access_token'
      })
      .expect(409)
      .end(done);
  });


  it("should reset account", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

    request(server)
      .del('/reset')
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
