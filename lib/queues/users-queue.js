'use strict';

var async = require('async');
var rarity = require('rarity');

var util = require('../util.js');
var Token = require('../models/token.js');

var userQueue = require('./user-queue.js');

module.exports = function usersQueueGenerator(server, config, workers, updateAccount) {
  return function usersQueue(job, finalCb) {
    var queue;

    async.waterfall([
      function retrieveToken(cb) {
        if(server.tokenCache.has(job.data.anyfetchToken)) {
          cb(null, server.tokenCache.get(job.data.anyfetchToken));
        }
        else {
          Token.findOne({anyfetchToken: job.data.anyfetchToken}).lean().exec(rarity.slice(2, cb));
        }
      },
      function createQueue(token, cb) {
        if(!token) {
          return cb(null);
        }

        queue = server.yaqsClient.createQueue(token.accountName, {concurrency: config.concurrency || 1});

        queue.on('error', util.logError);

        queue.on('job.failed', function(job, err) {
          console.log("Job " + job.id + " failed : " + err.toString());
          util.logError(err, job);
        });

        queue.on('job.completed', function(job) {
          console.log("Job " + job.id + " completed");
        });

        queue.on('job.timeout', function(job) {
          console.log("Job " + job.id + " timeout");
        });

        queue.once('empty', function() {
          queue.removeAllListeners(['error', 'job.failed', 'job.completed', 'job.timeout']);
          queue.remove(finalCb);
        });

        console.log("Starting queue for user " + token.accountName);

        queue
          .setWorker(userQueue(server, config, workers, updateAccount))
          .start(cb);
      }
    ], util.logError);
  };
};
