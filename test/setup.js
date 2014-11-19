var redis = require('redis');

before(function flushRedis(cb) {
  var client = redis.createClient();
  client.flushdb(cb);
});
