'use strict';

var async = require('async');
var rarity = require('rarity');

var util = require('../util.js');
var Token = require('../models/token.js');
var Childs = require('../Childs.js');

// This worker is used to manage a list of queues, it contain one task per user calling /update
module.exports = function usersQueueGenerator(server, config, workersFile, updateFile) {
  var log = require('../index.js').log;

  return function usersQueue(job, finalCb) {
    if(server.childs[job.data.anyfetchToken]) {
      return finalCb();
    }

    async.waterfall([
      function retrieveToken(cb) {
        // Try to get the token from cache, or load it once from the DB
        if(server.tokenCache.has(job.data.anyfetchToken)) {
          cb(null, server.tokenCache.get(job.data.anyfetchToken));
        }
        else {
          Token.findOne({anyfetchToken: job.data.anyfetchToken}).lean().exec(rarity.slice(2, cb));
        }
      },
      function createQueue(token, cb) {
        if(!token) {
          // Token was probably revoked
          finalCb();
          return cb(null);
        }

        log.info({
          user: token.accountName,
        }, "Starting tasks");

        token.anyfetchApiUrl = job.data.anyfetchApiUrl;

        var data = {
          updateFile: updateFile,
          workersFile: workersFile,
          config: config,
          token: token
        };

        var queue = server.yaqsClient.createQueue(token.accountName);

        // Start the childs, and add listeners
        var childs = new Childs(config.concurrency || 1, __dirname + '/../child-process.js', data);

        childs.on('stop', function(forced) {
          log.info({
            user: token.accountName
          }, "End of tasks");

          childs.removeAllListeners();

          if(forced) {
            return finalCb();
          }

          delete server.childs[token.anyfetchToken];
          queue.remove(finalCb);
        });

        childs.on('message', function(data) {
          if(data.type === 'event') {
            if(data.event === 'failed') {
              util.logError(data.err, data.job);
            }

            data.job.queue = queue;
            server.usersQueue.emit('job.' + data.job.data.type + '.' + data.event, data.job, data.err);
          }
        });

        childs.start();

        childs.queue = queue;
        childs.anyfetchApiUrl = token.anyfetchApiUrl;

        server.childs[token.anyfetchToken] = childs;

        cb();
      }
    ], util.logError);
  };
};
