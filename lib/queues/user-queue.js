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

        var retryConfig = {
          retry: config.retry,
          retryDelay: config.retryDelay
        };

        Object.keys(workers).forEach(function(name) {
          queues[name] = {
            processingCount: 0,
            totalCount: 0,
            push: function push(data) {
              if(job.data.params.identifier) {
                if(data.identifier !== job.data.params.identifier) {
                  return;
                }

                server.log.info({
                  title: data.title,
                  identifier: data.identifier
                }, "Reproviding");
              }
              else if(queues[name].totalCount > job.data.params.documents_per_update) {
                // Already saved too many documents. Skipping.
                return;
              }

              queues[name].totalCount += 1;
              queues[name].processingCount += 1;

              var newJob = job.queue.createJob({
                type: 'task',
                userData: data,
                userType: name,
                anyfetchToken: job.data.anyfetchToken
              }, retryConfig);

              newJob.save(function(err) {
                queues[name].processingCount -= 1;

                if(err) {
                  cb(err);
                  cb = function() {};
                  return;
                }
              });
            }
          };
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

          function waitAdding() {
            if(queues[name].processingCount === 0) {
              return cb();
            }

            setTimeout(waitAdding, 200);
          }

          waitAdding();
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
