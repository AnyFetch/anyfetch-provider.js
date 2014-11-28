'use strict';

var async = require('async');
var rarity = require('rarity');

var Token = require('../models/token.js');
var server = require('../index.js');


// This worker is used to manage specific tasks for a user (update / normal task)
module.exports = function userQueueGenerator(config, cache, anyfetchClient, workers, updateAccount) {
  function executeUpdateJob(token, job, cb) {
    async.waterfall([
      function callUpdateAccount(cb) {
        var queues = {};

        Object.keys(workers).forEach(function(name) {
          queues[name] = [];
        });

        updateAccount(token.data || {}, (job.data.params.identifier) ? null : token.cursor, queues, function(err, newCursor, providerData) {
          cb(err, queues, newCursor, providerData);
        });
      },
      function updateToken(queues, newCursor, providerData, cb) {
        if(job.data.params.identifier) {
          return cb(null, queues);
        }

        if(job.data.params.identifier) {
          return cb(null, queues);
        }

        if(providerData) {
          token.data = providerData;
          token.markModified('data');
        }

        token.cursor = newCursor;
        token.isUpdating = false;

        token.save(rarity.carryAndSlice([queues], 2, cb));
      },
      function pushJobToQueue(queues, cb) {
        async.eachSeries(Object.keys(workers), function(name, cb) {
          // The limit is applied for each queue. (For Anyfetch's providers, queues are addition and deletion)
          var documentsCount = 0;

          server.log.info({
            accountName: token.accountName,
            count: queues[name].length,
            name: name
          }, "New tasks");

          async.eachLimit(queues[name], 5, function(userData, cb) {
            if(documentsCount > job.data.params.documents_per_update || (job.data.params.identifier && userData.identifier !== job.data.params.identifier)) {
              return cb();
            }

            if(job.data.params.identifier) {
              server.log.info({
                title: userData.title,
                identifier: userData.identifier
              }, "Reproviding");
            }

            documentsCount += 1;

            var newJob = job.queue.createJob({
              type: 'task',
              userData: userData,
              userType: name,
              anyfetchToken: job.data.anyfetchToken
            }, {
              retry: config.retry,
              retryDelay: config.retryDelay
            });

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

    workers[job.data.userType](job, cb);
  }

  return function userQueue(job, cb) {
    async.waterfall([
      function retrieveToken(cb) {
        if(job.data.type !== 'update' && cache.server.has(job.data.anyfetchToken)) {
          cb(null, cache.server.get(job.data.anyfetchToken));
        }
        else {
          Token.findOne({anyfetchToken: job.data.anyfetchToken}).lean(job.data.type !== 'update').exec(rarity.slice(2, cb));
        }
      },
      function executeJob(token, cb) {
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
