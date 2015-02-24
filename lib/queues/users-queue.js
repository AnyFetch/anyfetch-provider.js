'use strict';

var async = require('async');
var rarity = require('rarity');
var Anyfetch = require('anyfetch');

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
        Token.findOne({anyfetchToken: job.data.anyfetchToken}).exec(rarity.slice(2, cb));
      },
      function createQueue(token, cb) {
        if(!token) {
          // Token was probably revoked
          finalCb();
          return cb(null);
        }

        var isFirst = !token.cursor;
        var dateStartOfTasks = new Date();

        log.info({
          user: token.accountName,
        }, "Starting tasks");

        var jsonToken = token.toJSON();
        jsonToken.anyfetchApiUrl = job.data.anyfetchApiUrl;

        var data = {
          updateFile: updateFile,
          workersFile: workersFile,
          config: config,
          token: jsonToken
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
          queue.remove(function(err) {
            if(err) {
              return finalCb(err);
            }

            var anyfetchClient = new Anyfetch(job.data.anyfetchToken);
            anyfetchClient.setApiUrl(job.data.anyfetchApiUrl);

            anyfetchClient.trackProviderUpdate({
              is_first: isFirst,
              time_spent_on_queue: dateStartOfTasks - token.lastUpdate,
              time_spentc_on_tasks: new Date() - dateStartOfTasks,
              total_time_spent: new Date() - token.lastUpdate
            }, util.logError);

            // Unlock the token
            token.isUpdating = false;
            token.save(finalCb);
          });
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
