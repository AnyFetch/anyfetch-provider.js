'use strict';

var async = require('async');
var rarity = require('rarity');
var events = require('events');
var util = require('util');

var Token = require('../models/token.js');
var server = require('../index.js');

var logError = require('../util.js').logError;

var Queue = function Queue(name, job, config) {
  this.processingCount = 0;
  this.totalCount = 0;

  this.name = name;
  this.job = job;
  this.config = config;
};

util.inherits(Queue, events.EventEmitter);

Queue.prototype.push = function pushToQueue(data) {
  if(this.job.data.params.identifier) {
    if(data.identifier !== this.job.data.params.identifier) {
      // Trying to reprovide a different document, skipping
      return;
    }

    server.log.info({
      title: data.title,
      identifier: data.identifier
    }, "Reproviding");
  }
  else if(this.totalCount > this.job.data.params.documents_per_update) {
    // Already saved too many documents. Skipping.
    return;
  }

  this.totalCount += 1;
  this.processingCount += 1;

  var retryConfig = {
    retry: this.config.retry,
    retryDelay: this.config.retryDelay
  };

  var newJob = this.job.queue.createJob({
    type: 'task',
    userData: data,
    userType: this.name,
    anyfetchToken: this.job.data.anyfetchToken
  }, retryConfig);

  var self = this;
  newJob.save(function(err) {
    self.processingCount -= 1;

    if(self.processingCount === 0) {
      self.emit('drain');
    }

    logError(err);
  });
};

Queue.prototype.concat = function concatToQueue(datas) {
  var self = this;
  (datas || []).forEach(function(data) {
    self.push(data);
  });
};

// This worker is used to manage specific tasks for a user (update / standard task)
module.exports = function userQueueGenerator(config, cache, anyfetchClient, workers, updateAccount) {
  function executeUpdateJob(token, job, cb) {
    async.waterfall([
      function callUpdateAccount(cb) {
        var queues = {};

        Object.keys(workers).forEach(function(name) {
          queues[name] = new Queue(name, job, config);
        });

        if(token.data) {
          token.data.documentsPerUpdate = job.data.params.documents_per_update;
        }

        // Retrieve the list of tasks to execute for this user.
        updateAccount(token.data || {documentsPerUpdate: job.data.params.documents_per_update}, (job.data.params.identifier) ? null : token.cursor, queues, function(err, newCursor, providerData) {
          cb(err, queues, newCursor, providerData);
          cb = function() {};
        });
      },
      function updateToken(queues, newCursor, providerData, cb) {
        if(job.data.params.identifier) {
          return cb(null, queues);
        }

        // In some special cases, the provider can ask to update its data on each run (rolling refresh_token for instance)
        if(providerData) {
          token.data = providerData;
          token.markModified('data');
        }

        token.cursor = newCursor;
        token.markModified('cursor');

        token.save(rarity.carryAndSlice([queues], 2, cb));
      },
      function waitQueues(queues, cb) {
        // Retrieve the tasks from each worker
        async.eachSeries(Object.keys(workers), function(name, cb) {
          server.log.info({
            accountName: token.accountName,
            count: queues[name].totalCount,
            name: name
          }, "New tasks");

          if(queues[name].processingCount === 0) {
            // All documents have already been pushed, we can continue
            return cb();
          }

          // Else, we have to wait for all documents to be saved on Redis before continuing.
          // The queue will emit() the drain event when all jobs have been saved
          queues[name].on('drain', cb);
        }, cb);
      }
    ], cb);
  }

  function executeTaskJob(token, job, cb) {
    job.task = job.data.userData;
    job.serviceData = token.data;
    job.cache = cache.user;
    job.anyfetchClient = anyfetchClient;

    workers[job.data.userType](job, function(err) {
      // Discard errors for HTTP 410 Gone -- the resource is not available anymore, but no need to log an error.
      if(err && err.toString().match(/got 410/i)) {
        err = null;
      }

      cb(err);
    });
  }

  return function userQueue(job, cb) {
    async.waterfall([
      function retrieveToken(cb) {
        // Try to get the token from cache to avoid costly DB calls -- we'll use the same tokens for all tasks.
        if(job.data.type !== 'update' && cache.server.has(job.data.anyfetchToken)) {
          cb(null, cache.server.get(job.data.anyfetchToken));
        }
        else {
          Token.findOne({anyfetchToken: job.data.anyfetchToken}).lean(job.data.type !== 'update').exec(rarity.slice(2, cb));
        }
      },
      function executeJob(token, cb) {
        // Token was removed (maybe revoked?)
        // Skip.
        if(!token) {
          return cb(null);
        }

        server.log.info({
          id: job.id,
          type: job.data.type,
          user: token.accountName
        }, "Executing job");

        if(job.data.type === 'update') {
          executeUpdateJob(token, job, cb);
        }
        else {
          cache.server.set(job.data.anyfetchToken, token);
          executeTaskJob(token, job, cb);
        }
      }
    ], cb);
  };
};
