'use strict';

require('should');
var request = require('supertest');
var async = require('async');
var Anyfetch = require('anyfetch');

var AnyFetchProvider = require('../lib/');
var TempToken = require('../lib/models/temp-token.js');
var Token = require('../lib/models/token.js');

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


describe("AnyFetchProvider.createServer()", function() {
  describe('/ endpoint', function() {
    it("should redirect to anyfetch.com", function(done) {
      var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

      request(server).get('/')
        .expect(302)
        .expect('Location', 'http://anyfetch.com')
        .end(done);
    });
  });

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

  describe("/update endpoint", function() {
    var updateServer = function(server, done) {
      if(!done) {
        done = function(err) {
          if(err) {
            throw err;
          }
        };
      }

      request(server).post('/update')
        .send({
          access_token: 'thetoken',
          api_url: 'http://api.anyfetch.com'
        })
        .expect(202)
        .end(done);
    };

    var token;

    beforeEach(AnyFetchProvider.debug.cleanTokens);
    beforeEach(function(done) {
      // Create a token, as-if /init/ workflow was properly done
      token = new Token({
        anyfetchToken: 'thetoken',
        data: {
          foo: 'bar'
        },
        accountName: 'accountName'
      });

      token.save(done);
    });


    it("should require access_token to update", function(done) {
      var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

      request(server)
        .post('/update')
        .send({
          api_url: process.env.ANYFETCH_MANAGER_URL
        })
        .expect(409)
        .expect(/access_token/)
        .end(done);
    });


    it("should require api_url to update", function(done) {
      var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

      request(server)
        .post('/update')
        .send({
          access_token: '123'
        })
        .expect(409)
        .expect(/api_url/)
        .end(done);
    });

    it("should require valid access_token to update", function(done) {
      var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

      request(server)
        .post('/update')
        .send({
          access_token: 'dummy_access_token',
          api_url: 'http://api.anyfetch.com'
        })
        .expect(409)
        .end(done);
    });

    it("should retrieve tasks and upload them", function(done) {

      var tasks = [{a:1}, {a:2}, {a:3}];
      var counter = 1;

      var updateAccount = function(serviceData, cursor, queues, cb) {
        // Update the account !
        tasks.forEach(function(task) {
          queues.test.push(task);
        });

        cb(null, new Date());
      };

      var queueWorker = function(job, cb) {
        // Upload document
        job.task.should.have.property('a').within(1, 3);
        job.serviceData.should.have.property('foo', 'bar');

        counter += 1;
        if(counter === tasks.length) {
          done();
        }
        cb();
      };

      var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {test: queueWorker}, config);
      updateServer(server);
    });

    it("should allow to update token data", function(done) {
      // We need to use test2 queue instead of test because this event worker can't override the last worker in the last test
      var updateAccount = function(serviceData, cursor, queues, cb) {
        serviceData.newKey = 'newValue';
        queues.test2.push({});
        cb(null, new Date(), serviceData);
      };

      var queueWorker = function(job, cb) {
        job.serviceData.should.have.property('newKey', 'newValue');
        done();
        cb();
      };

      var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {test2: queueWorker}, config);
      updateServer(server);
    });
  });

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
});
