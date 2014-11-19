'use strict';

require('should');
var request = require('supertest');

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
        access_token: 'thetoken',
        api_url: 'http://api.anyfetch.com',
        documents_per_update: 100
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
      accountName: 'test@anyfetch.com'
    });

    token.save(done);
  });


  it("should require access_token to update", function(done) {
    var server = AnyFetchProvider.createServer(connectFunctions, workersFile, updateFile, config);

    request(server)
      .post('/update')
      .send({
        api_url: process.env.ANYFETCH_MANAGER_URL,
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

  it("should retrieve tasks and upload them", function(done) {
    this.timeout(10000);

    var counter = 0;
    var server = AnyFetchProvider.createServer(connectFunctions, __dirname + '/../helpers/workers-test-1.js', __dirname + '/../helpers/update-test.js', config);

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

  it("should retrieve tasks and upload just one task", function(done) {
    var counter = 0;
    var server = AnyFetchProvider.createServer(connectFunctions, __dirname + '/../helpers/workers-test-2.js', __dirname + '/../helpers/update-test.js', config);

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
});
