'use strict';

require('should');
var request = require('supertest');
var redis = require('redis');
var async = require('async');

var AnyFetchProvider = require('../../lib/');
var helpers = require('./helpers');

var connectFunctions = helpers.connectFunctions;
var workersFile = helpers.workersFile;
var updateFile = helpers.updateFile;
var config = helpers.config;

describe("GET /status endpoint", function() {
  var server;

  before(function flushRedis(cb) {
    var client = redis.createClient();
    client.flushdb(cb);
  });

  before(function createRedisEnv(done) {
    server = AnyFetchProvider.createServer(connectFunctions, workersFile, updateFile, config);

    var queues = [
      {
        name: 'anyfetch-provider-users',
        pending: 1,
        processing: 2
      },
      {
        name: 'test1@anyfetch.com',
        pending: 30,
        processing: 10
      },
      {
        name: 'test2@anyfetch.com',
        pending: 45,
        processing: 5
      },
      {
        name: 'test3@anyfetch.com',
        pending: 1,
        processing: 0
      }
    ];

    async.each(queues, function(data, cb) {
      var queue;
      async.waterfall([
        function createQueue(cb) {
          queue = server.yaqsClient.createQueue(data.name, {});
          queue.stop(function() {
            cb();
          });
        },
        function addJobs(cb) {
          var conn = queue.conn.multi();

          conn = conn.hsetnx(queue.getPrefix(), 'total', 0);

          for(var i = 0; i < data.pending; i += 1) {
            conn = conn.zadd(queue.getPrefix('pending'), 0, 'pending-' + i);
          }

          for(var j = 0; j < data.processing; j += 1) {
            conn = conn.zadd(queue.getPrefix('processing'), 0, 'processing-' + j);
          }

          conn.exec(cb);
        }
      ], cb);
    }, done);
  });

  it("should display informations", function(done) {
    request(server)
      .get('/status')
      .expect(200)
      .expect(function(res) {
        res.body.should.containDeep({
          pending_documents: 76,
          pending_queues: [
            {pending: 45, processing: 5},
            {pending: 1, processing: 0},
            {pending: 30, processing: 10}
          ],
          users: {pending: 1, processing: 2}
        });
      })
      .end(done);
  });

  after(function flushRedis(cb) {
    var client = redis.createClient();
    client.flushdb(cb);
  });
});
