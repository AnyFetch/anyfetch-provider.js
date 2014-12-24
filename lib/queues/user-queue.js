'use strict';

var async = require('async');
var rarity = require('rarity');

var Token = require('../models/token.js');
var server = require('../index.js');


// This worker is used to manage specific tasks for a user (update / standard task)
module.exports = function userQueueGenerator(config, cache, anyfetchClient, workers, updateAccount) {
  function executeUpdateJob(token, job, cb) {
    async.waterfall([
      function callUpdateAccount(cb) {
        var queues = {};

        Object.keys(workers).forEach(function(name) {
          queues[name] = [];
        });

        if(token.data) {
          token.data.documentsPerUpdate = job.data.params.documents_per_update;
        }

        // Retrieve the list of tasks to execute for this user.
        updateAccount(token.data || {documentsPerUpdate: job.data.params.documents_per_update}, (job.data.params.identifier) ? null : token.cursor, queues, function(err, newCursor, providerData) {
          cb(err, queues, newCursor, providerData);
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
      function pushJobToQueue(queues, cb) {
        // Retrieve the tasks from each worker
        async.eachSeries(Object.keys(workers), function(name, cb) {
          server.log.info({
            accountName: token.accountName,
            count: queues[name].length,
            name: name
          }, "New tasks");

          if(job.data.params.identifier) {
            // When trying to reprovide a single document, filter other tasks.
            queues[name] = queues[name].filter(function(userData) {
              return userData.identifier === job.data.params.identifier;
            });
            if(queues[name].length === 1) {
              server.log.info({
                title: queues[name][0].title,
                identifier: queues[name][0].identifier
              }, "Reproviding");
            }
          }

          // Remove excedentary tasks (slice the array at doocument_per_update, tasks after this one are discarded)
          // The limit is applied for each queue. (For Anyfetch's providers, queues are addition and deletion)
          queues[name] = queues[name].slice(0, job.data.params.documents_per_update);

          var retryConfig = {
            retry: config.retry,
            retryDelay: config.retryDelay
          };

          async.eachLimit(queues[name], 5, function(userData, cb) {
            // Create jobs for every task!
            var newJob = job.queue.createJob({
              type: 'task',
              userData: userData,
              userType: name,
              anyfetchToken: job.data.anyfetchToken
            }, retryConfig);

            newJob.save(cb);
          }, cb);
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
