'use strict';

require('should');
var request = require('supertest');

var AnyFetchProvider = require('../../lib/');
var Token = require('../../lib/models/token.js');
var helpers = require('./helpers');

var connectFunctions = helpers.connectFunctions;
var updateAccount = helpers.updateAccount;
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
    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

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
    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

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
    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {}, config);

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

    var tasks = [{a: 1, identifier: 'a'}, {a: 2, identifier: 'b'}, {a: 3, identifier: 'c'}];
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

  it("should retrieve tasks and upload just one task", function(done) {
    var tasks = [{a:1, identifier: 'a'}, {a:2, identifier: 'b'}, {a:3, identifier: 'c'}];

    // We need to use test2 queue instead of test because this event worker can't override the last worker in the last test
    var updateAccount = function(serviceData, cursor, queues, cb) {
      // Update the account !
      tasks.forEach(function(task) {
        queues.test2.push(task);
      });

      cb(null, new Date());
    };

    var queueWorker = function(job, cb) {
      // Upload document
      job.task.should.have.property('a', 2);
      job.serviceData.should.have.property('foo', 'bar');

      cb();
      done();
    };

    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {test2: queueWorker}, config);
    updateServer(server, 'b');
  });

  it("should allow to update token data", function(done) {
    // We need to use test3 queue instead of test because this event worker can't override the last worker in the last test
    var updateAccount = function(serviceData, cursor, queues, cb) {
      serviceData.newKey = 'newValue';
      queues.test3.push({});
      cb(null, new Date(), serviceData);
    };

    var queueWorker = function(job, cb) {
      job.serviceData.should.have.property('newKey', 'newValue');
      done();
      cb();
    };

    var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, {test3: queueWorker}, config);
    updateServer(server);
  });
});
