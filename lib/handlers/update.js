'use strict';
/**
 * @file Update an account from specified access_token
 *
 */

var async = require('async');
var restify = require('restify');

var Token = require('../models/token.js');


/**
 * This handler downloads data for the specified access_token and starts uploading them onto AnyFetch.
 *
 * @param {Object} req Request object from the client
 * @param {Object} res Response we want to return
 * @param {Function} next Callback to call once res has been populated.
 */
module.exports = function(updateAccount, queue, workers) {
  return function(req, res, next) {
    if(!req.params.access_token) {
      return next(new restify.MissingParameterError("Missing access_token parameter."));
    }
    if(!req.params.api_url) {
      return next(new restify.MissingParameterError("Missing api_url parameter."));
    }

    Token.findOne({anyfetchToken: req.params.access_token}, function(err, token) {
      if(err) {
        return next(err);
      }
      if(!token) {
        return next(new restify.InvalidArgumentError("Unknown token."));
      }
      if(token.isUpdating && queue.job_counter !== 0) {
        res.send(204);
        return next();
      }
      if(token.isUpdating && queue.job_counter === 0) {
        // If the token is marked as updating but the queue is empty, we force the update (we had a provider crash or something went wrong, anyway best behavior is to retry)
        res.header('X-Restart-Forced', 'true');
        res.send(202);
        console.log("Restarting update after crash");
      }
      else {
        res.send(202);
      }
      next();

      async.waterfall([
        function updateToken(cb) {
          // Update token
          token.lastUpdate = new Date();
          token.isUpdating = true;

          token.save(function(err) {
            cb(err);
          });
        },
        function callUpdateAccount(cb) {
          var queues = {};

          Object.keys(workers).forEach(function(name) {
            queues[name] = {
              push: (function createPushMethod(name) {
                return function(task) {
                  queue.job_counter += 1;
                  task.anyfetchToken = token.anyfetchToken;

                  queue.empty = false;
                  queue.create(name, task)
                    .attempts(10)
                    .save();
                };
              })(name)
            };
          });
          updateAccount(token.data, token.cursor, queues, function(err, newCursor, providerData) {
            cb(err, newCursor, providerData);
          });
        },
        function updateToken(newCursor, providerData, cb) {
          if(providerData) {
            token.data = providerData;
            token.markModified('data');
            token.cursor = newCursor;
            token.markModified('cursor');
            token.isUpdating = false;
            token.markModified('isUpdating');

            token.save(cb);
          }
          else {
            cb(null, newCursor);
          }
        }
      ], function(err) {
        if(err) {
          console.log('ERR:', err);
        }
      });
    });
  };
};
