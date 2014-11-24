'use strict';

var async = require('async');
var rarity = require('rarity');

var util = require('../util.js');
var Token = require('../models/token.js');
var Childs = require('../Childs.js');

// This worker is use to manage a list of queues, it contain one task per user which call /update
module.exports = function usersQueueGenerator(server, config, workersFile, updateFile) {
  return function usersQueue(job, finalCb) {
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

        console.log("Starting tasks for user `" + token.accountName + "`");

        token.anyfetchApiUrl = job.data.anyfetchApiUrl;

        var data = {
          updateFile: updateFile,
          workersFile: workersFile,
          config: config,
          token: token
        };

        var queue = server.yaqsClient.createQueue(token.accountName);
        var childs = new Childs(config.concurrency || 1, __dirname + '/../child-process.js', data);

        childs.on('stop', function() {
          console.log("End of tasks for user `" + token.accountName + "`");

          childs.removeAllListeners();
          queue.remove(finalCb);
        });

        childs.on('message', function(data) {
          if(data.type === 'event') {
            data.job.queue = queue;
            server.usersQueue.emit('job.' + data.job.data.type + '.' + data.event, data.job, data.err);
          }
          else if(data.type === 'error') {
            util.logError(data.err);
          }
        });

        childs.on('kill', function() {
          console.log("End of tasks for user `" + token.accountName + "`");

          childs.removeAllListeners();
          finalCb();
        });

        childs.start();

        childs.anyfetchApiUrl = token.anyfetchApiUrl;
        server.childs[token.anyfetchToken] = childs;

        cb();
      }
    ], util.logError);
  };
};
