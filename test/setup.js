'use strict';

var redis = require('redis');
var Logger = require("bunyan");


before(function flushRedis(cb) {
  var client = redis.createClient();
  client.flushdb(cb);
});

var log = new Logger.createLogger({
  name: 'toNull',
  streams: [{
      path: '/dev/null',
  }]
});
require('../lib/index.js').log = log;
