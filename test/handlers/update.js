'use strict';

require('should');
var AnyFetch = require('anyfetch');
var request = require('supertest');
var async = require('async');

var AnyFetchProvider = require('../../lib/');
var Token = require('../../lib/models/token.js');
var helpers = require('./helpers');

var connectFunctions = helpers.connectFunctions;
var workersFile = helpers.workersFile;
var updateFile = helpers.updateFile;
var config = helpers.config;

describe("POST /update endpoint", function() {
  var updateServer = function(server, identifier, done) {
    if(!done) {
      done = function(err) {
        if(err) {
          throw err;
        }
      };
    }

    request(server).post('/update' + (identifier ? '/' + identifier : ''))
      .send({
        access_token: server.token,
        api_url: 'http://localhost:1337',
        documents_per_update: 100,
        force: server.force
      })
      .expect(202)
      .end(done);
  };

  var mockServer;
  before(function(done) {
    mockServer = AnyFetch.createMockServer();

    var port = 1337;
    var apiUrl = 'http://localhost:' + port;

    mockServer.listen(port, function() {
      console.log('AnyFetch mock server running on ' + apiUrl);
      AnyFetch.setApiUrl(apiUrl);
      AnyFetch.setManagerUrl(apiUrl);

      done();
    });
  });

  after(function(done) {
    mockServer.close(done);
  });

  var token;

  beforeEach(AnyFetchProvider.debug.cleanTokens);

  beforeEach(function createToken1(done) {
    // Create a token, as-if /init/ workflow was properly done
    token = new Token({
      anyfetchToken: 'thetoken',
      data: {
        foo: 'bar'
      },
      accountName: 'test@anyfetch.com'
    });

    token.save(done);
  });

  beforeEach(function createToken2(done) {
    // Create a token, as-if /init/ workflow was properly done
    token = new Token({
      anyfetchToken: 'thetoken2',
      data: {
        foo: 'bar'
      },
      accountName: 'test@anyfetch.com',
      isUpdating: true,
      lastUpdate: new Date()
    });

    token.save(done);
  });

  beforeEach(function createToken3(done) {
    // Create a token, as-if /init/ workflow was properly done
    token = new Token({
      anyfetchToken: 'thetoken3',
      data: {
        foo: 'bar'
      },
      accountName: 'test@anyfetch.com',
      isUpdating: true,
      lastUpdate: new Date(Date.now() - 5 * 3600 * 1000 - 1)
    });

    token.save(done);
  });

  beforeEach(function createToken4(done) {
    // Create a token, as-if /init/ workflow was properly done
    token = new Token({
      anyfetchToken: 'thetoken4',
      data: {
        foo: 'bar'
      },
      accountName: 'test@anyfetch.com',
      isUpdating: true,
      lastUpdate: new Date(Date.now() - 5 * 3600 * 1000 - 1),
      requireRefresh: true
    });

    token.save(done);
  });

  it("should require access_token to update", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, workersFile, updateFile, config);

    request(server)
      .post('/update')
      .send({
        api_url: 'http://api.anyfetch.com',
        documents_per_update: 100
      })
      .expect(409)
      .expect(/access_token/)
      .end(done);
  });

  it("should require documents_per_update to update", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, workersFile, updateFile, config);

    request(server)
      .post('/update')
      .send({
        access_token: 'thetoken',
        api_url: 'http://api.anyfetch.com',
      })
      .expect(409)
      .expect(/documents_per_update/)
      .end(done);
  });

  it("should require valid access_token to update", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, workersFile, updateFile, config);

    request(server)
      .post('/update')
      .send({
        access_token: 'dummy_access_token',
        api_url: 'http://api.anyfetch.com',
        documents_per_update: 100
      })
      .expect(404)
      .end(done);
  });

  it("should require isUpdating to false to update", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, workersFile, updateFile, config);

    request(server)
      .post('/update')
      .send({
        access_token: 'thetoken2',
        api_url: 'http://api.anyfetch.com',
        documents_per_update: 100
      })
      .expect(429)
      .end(done);
  });

  it("should fail with a token which need a refresh", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, workersFile, updateFile, config);

    request(server)
      .post('/update')
      .send({
        access_token: 'thetoken4',
        api_url: 'http://api.anyfetch.com',
        documents_per_update: 100
      })
      .expect(428)
      .end(done);
  });

  it("should update with isUpdating to true and force", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, __dirname + '/../helpers/workers-test.js', __dirname + '/../helpers/update-test.js', config);

    server.token = 'thetoken2';
    server.force = true;

    updateServer(server, null, function(err) {
      if(err) {
        return done(err);
      }

      server.usersQueue.once('empty', function() {
        done();
      });
    });
  });

  it("should update with isUpdating to true and a good lastUpdate", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, __dirname + '/../helpers/workers-test.js', __dirname + '/../helpers/update-test.js', config);

    server.token = 'thetoken3';

    updateServer(server, null, function(err) {
      if(err) {
        return done(err);
      }

      server.usersQueue.once('empty', function() {
        done();
      });
    });
  });

  it("should retrieve tasks and upload them", function(done) {
    this.timeout(10000);

    var counter = 0;
    var server = AnyFetchProvider.createServer(connectFunctions, __dirname + '/../helpers/workers-test-1.js', __dirname + '/../helpers/update-test.js', config);

    server.token = 'thetoken';
    server.force = false;

    server.usersQueue.on('job.task.completed', function() {
      counter += 1;
    });

    server.usersQueue.on('job.task.failed', function(job, err) {
      done(err);
    });

    server.usersQueue.on('job.update.failed', function(job, err) {
      done(err);
    });

    updateServer(server, null, function(err) {
      if(err) {
        return done(err);
      }

      server.usersQueue.once('empty', function() {
        server.usersQueue.removeAllListeners();
        counter.should.eql(3);

        Token.findOne({anyfetchToken: 'thetoken'}, function(err, token) {
          if(err) {
            return done(err);
          }

          token.isUpdating.should.eql(false);
          done();
        });
      });
    });
  });

  it("should retrieve tasks and upload just one task", function(done) {
    var counter = 0;
    var server = AnyFetchProvider.createServer(connectFunctions, __dirname + '/../helpers/workers-test-2.js', __dirname + '/../helpers/update-test.js', config);

    server.token = 'thetoken';
    server.force = false;

    server.usersQueue.on('job.task.completed', function() {
      counter += 1;
    });

    server.usersQueue.on('job.task.failed', function(job, err) {
      done(err);
    });

    server.usersQueue.on('job.update.failed', function(job, err) {
      done(err);
    });

    updateServer(server, 'b', function(err) {
      if(err) {
        return done(err);
      }

      server.usersQueue.once('empty', function() {
        server.usersQueue.removeAllListeners();
        counter.should.eql(1);
        done();
      });
    });
  });

  it("should allow to update token data", function(done) {
    var counter = 0;
    var server = AnyFetchProvider.createServer(connectFunctions, __dirname + '/../helpers/workers-test-3.js', __dirname + '/../helpers/update-test.js', config);

    server.token = 'thetoken';
    server.force = false;

    server.usersQueue.on('job.task.completed', function() {
      counter += 1;
    });

    server.usersQueue.on('job.task.failed', function(job, err) {
      done(err);
    });

    server.usersQueue.on('job.update.failed', function(job, err) {
      done(err);
    });

    updateServer(server, null, function(err) {
      if(err) {
        return done(err);
      }

      server.usersQueue.once('empty', function() {
        server.usersQueue.removeAllListeners();
        counter.should.eql(3);
        done();
      });
    });
  });

  it("should set requireRefresh to true when we send a TokenError", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, __dirname + '/../helpers/workers-token-error.js', __dirname + '/../helpers/update-test.js', config);

    server.token = 'thetoken';
    server.force = false;

    async.waterfall([
      function update(cb) {
        server.usersQueue.on('job.task.failed', function(job, err) {
          cb(err);
        });

        server.usersQueue.on('job.update.failed', function(job, err) {
          cb(err);
        });

        updateServer(server, null, function(err) {
          if(err) {
            return cb(err);
          }

          server.usersQueue.once('empty', function() {
            console.log("EMPTY");
            server.usersQueue.removeAllListeners();
            cb();
          });
        });
      },
      function retrieveToken(cb) {
        Token.findOne({anyfetchToken: 'thetoken'}, cb);
      },
      function checkToken(token, cb) {
        if(!token) {
          return cb(new Error("Can't retrieve token"));
        }

        token.requireRefresh.should.eql(true);
        cb();
      }
    ], done);
  });
});
