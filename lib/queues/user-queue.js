'use strict';

var async = require('async');
var rarity = require('rarity');
var Anyfetch = require('anyfetch');

var Token = require('../models/token.js');

module.exports = function userQueueGenerator(server, config, workers, updateAccount) {
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

          console.log("User `" + token.accountName + "` pushed " + queues[name].length + " tasks onto queue `" + name + "`");

          async.eachLimit(queues[name], 5, function(userData, cb) {
            if(documentsCount > job.data.params.documents_per_update || (job.data.params.identifier && userData.identifier !== job.data.params.identifier)) {
              return cb();
            }

            if(job.data.params.identifier) {
              console.log("Reproviding", userData.title, "(", userData.identifier, ")");
            }

            documentsCount += 1;

            var newJob = job.queue.createJob({
              type: 'normal',
              userData: userData,
              userType: name,
              anyfetchToken: token.anyfetchToken,
              anyfetchApiUrl: job.data.params.api_url || process.env.API_URL || "https://api.anyfetch.com"
            }, {
              retry: config.attempts,
              retryDelay: config.backoff
            });

            newJob.save(cb);
          }, cb);
        }, cb);
      }
    ], cb);
  }

  function executeNormalJob(token, job, cb) {
    job.task = job.data.userData;
    job.serviceData = token.data;
    job.cache = server.userCache;
    job.anyfetchClient = token.anyfetchClient;

    workers[job.data.userType](job, cb);
  }

  return function userQueue(job, cb) {
    async.waterfall([
      function retrieveToken(cb) {
        if(job.data.type !== 'update' && server.tokenCache.has(job.data.anyfetchToken)) {
          cb(null, server.tokenCache.get(job.data.anyfetchToken));
        }
        else {
          Token.findOne({anyfetchToken: job.data.anyfetchToken}).exec(rarity.slice(2, cb));
        }
      },
      function executeJob(token, cb) {
        if(!token) {
          return cb(null);
        }

        console.log("Executing job " + job.id + " of type " + job.data.type + " for user " + token.accountName);

        if(job.data.type === 'update') {
          executeUpdateJob(token, job, cb);
        }
        else {
          if(!token.anyfetchClient) {
            token.anyfetchClient = new Anyfetch(job.data._anyfetchToken);
            token.anyfetchClient.setApiUrl(job.data.anyfetchApiUrl);
          }

          server.tokenCache.set(job.data.anyfetchToken, token);

          executeNormalJob(token, job, cb);
        }
      }
    ], cb);
  };
};
