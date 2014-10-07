'use strict';
/**
 * @file Update an account from specified access_token
 *
 */

var async = require('async');
var restify = require('restify');
var rarity = require('rarity');

var util = require('../util.js');

/**
 * This handler downloads data for the specified access_token and starts uploading them onto AnyFetch.
 *
 */
module.exports.postGenerator = function postGenerator(updateAccount, queue, workers, config) {
  return function updatePost(req, res, next) {
    if(!req.params.access_token) {
      return next(new restify.MissingParameterError("Missing access_token parameter."));
    }
    if(!req.params.api_url) {
      return next(new restify.MissingParameterError("Missing api_url parameter."));
    }
    if(!req.params.documents_per_update && !req.params.identifier) {
      return next(new restify.MissingParameterError("Missing documents_per_update parameter."));
    }

    console.log("Token for update", JSON.stringify(req.token));

    if(req.token.isUpdating && !req.params.force) {
      if(Date.now() - req.token.lastUpdate.getTime() < 5 * 3600 * 1000) {
        console.warn("Already processing");
        return next(new restify.TooManyRequestsError('Already processing'));
      }
      else {
        console.warn("WARN: retrying providing after potential crash", JSON.stringify(req.token));
        res.send(202);
      }
    }
    else {
      res.send(202);
    }
    next();

    async.waterfall([
      function updateToken(cb) {
        if (req.params.identifier) {
          return cb(null);
        }

        // Update token
        req.token.lastUpdate = new Date();
        req.token.isUpdating = true;

        req.token.save(rarity.slice(1, cb));
      },
      function callUpdateAccount(cb) {
        var queues = {};

        Object.keys(workers).forEach(function(name) {
          queues[name] = [];
        });

        updateAccount(req.token.data || {}, (req.params.identifier) ? null : req.token.cursor, queues, function(err, newCursor, providerData) {
          cb(err, queues, newCursor, providerData);
        });
      },
      function updateToken(queues, newCursor, providerData, cb) {
        if (req.params.identifier) {
          return cb(null, queues);
        }

        if(providerData) {
          req.token.data = providerData;
          req.token.markModified('data');
        }
        req.token.cursor = newCursor;
        req.token.isUpdating = false;

        req.token.save(rarity.carryAndSlice([queues], 2, cb));
      },
      function executeQueue(queues, cb) {
        Object.keys(workers).forEach(function(name) {
          // The limit is applied for each queue. (For Anyfetch's providers, queues are addition and deletion)
          var documentsCount = 0;
          console.log("User `" + req.token.accountName + "` pushed " + queues[name].length + " tasks onto queue `" + name + "`");
          queues[name].every(function(task) {
            if((documentsCount < req.params.documents_per_update && !req.params.identifier) || (task.identifier === req.params.identifier)) {
              if (req.params.identifier) {
                console.log("Reproviding", task.title, "(", task.identifier, ")");
              }

              task._anyfetchToken = req.token.anyfetchToken;
              task._anyfetchApiUrl = req.params.api_url;

              var job = queue.create(name, task).removeOnComplete(true);
              if(config.kue && config.kue.attempt) {
                job.attempt(config.kue.attemp);

                if(config.kue && config.kue.backoff) {
                  job.backoff(config.kue.backoff);
                }
              }

              if(config.kue && config.kue.delay) {
                job.delay(config.kue.delay);
              }

              job.save();
              documentsCount += 1;
              return (req.params.identifier) ? false : true;
            }
            return (req.params.identifier) ? true : false;
          });
        });
        cb(null);
      }
    ], function(err) {
      util.logError(err, {params: req.params, token: req.token});
    });
  };
};
