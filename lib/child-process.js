'use strict';

var lru = require('lru-cache');
var yaqs = require('yaqs');
var Anyfetch = require('anyfetch');

var connectMongo = require('./util.js').connectMongo;
var userQueue = require('./queues/user-queue.js');
var log = require('./index.js').log;
var logError = require('./util.js').logError;

var anyfetchClient;
var yaqsClient;
var queue;
var workers;
var updateAccount;

var cache = {
  user: lru({
    max: 50,
    length: function() {
      return 1;
    },
    maxAge: 60 * 60 * 1000
  }),

  server: lru({
    max: 50,
    length: function() {
      return 1;
    },
    maxAge: 60 * 60 * 1000
  })
};

process.on('uncaughtException', function(err) {
  if(process.connected) {
    process.send({
      type: 'error',
      err: err.toString(),
      errStack: err.stack
    });
  }

  process.exit(1);
});

process.on('message', function(data) {
  if(data.exit) {
    return process.exit(0);
  }

  connectMongo(data.config.mongoUrl);

  logError.config = data.config;

  if(data.config.opbeat && data.config.opbeat.secretToken) {
    var opbeat = require('opbeat');
    logError.opbeat = opbeat(data.config.opbeat);
  }

  updateAccount = require(data.updateFile);
  workers = require(data.workersFile);

  yaqsClient = yaqs({
    prefix: data.config.appName || data.config.providerUrl,
    redis: data.config.redisUrl
  });

  queue = yaqsClient.createQueue(data.token.accountName, {concurrency: 1});

  anyfetchClient = new Anyfetch(data.token.anyfetchToken);
  anyfetchClient.setApiUrl(data.token.anyfetchApiUrl);

  function emitEvent(event, job, err) {
    job = {
      id: job.id,
      data: job.data,

      queue: {
        id: job.queue.id,
        name: job.queue.name
      }
    };

    var data = {
      type: 'event',
      event: event,
      job: job,
      err: err && err.toString(),
      errStack: err && err.stack
    };

    if(process.connected) {
      process.send(data);
    }
  }

  queue.on('job.failed', function(job, err) {
    log.warn(err, {
      id: job.id
    }, "Job failed");
    emitEvent('failed', job, err);
  });

  queue.on('job.completed', function(job) {
    emitEvent('completed', job);
  });

  queue.on('job.timeout', function(job) {
    emitEvent('timeout', job);
  });

  queue.on('empty', function() {
    process.send({
      type: 'state',
      processing: false
    });
  });

  queue.on('resumed', function() {
    process.send({
      type: 'state',
      processing: true
    });
  });

  queue.on('error', function(err) {
    throw err;
  });

  queue
    .setWorker(userQueue(data.config, cache, anyfetchClient, workers, updateAccount))
    .start();
});

process.on('SIGTERM', function() {
  queue.stop(function(err) {
    if(err) {
      log.error(err, "Unable to stop queue");
    }

    process.exit(0);
  });
});
