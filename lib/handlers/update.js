'use strict';
/**
 * @file Update an account from specified access_token
 *
 */

var async = require('async');
var restify = require('restify');
var rarity = require('rarity');

var Token = require('../models/token.js');


/**
 * This handler downloads data for the specified access_token and starts uploading them onto AnyFetch.
 *
 */
module.exports = function(updateAccount, queue, workers) {
  return function(req, res, next) {
    if(!req.params.access_token) {
      console.warn("ERR: Missing access_token parameter.");
      return next(new restify.MissingParameterError("Missing access_token parameter."));
    }
    if(!req.params.api_url) {
      console.warn("ERR: Missing api_url parameter.");
      return next(new restify.MissingParameterError("Missing api_url parameter."));
    }
    if(!req.params.documents_per_update) {
      console.warn("ERR: Missing documents_per_update parameter.");
      return next(new restify.MissingParameterError("Missing documents_per_update parameter."));
    }

    Token.findOne({anyfetchToken: req.params.access_token}, function(err, token) {
      if(err) {
        console.warn("ERR:", err);
        return next(err);
      }
      if(!token) {
        console.warn("ERR: Unknown token.");
        return next(new restify.InvalidArgumentError("Unknown token."));
      }
      if(token.isUpdating) {
        console.warn("ERR: Already processing");
        return next(new restify.TooManyRequestsError('Already processing'));
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
          token.lastUpdate = new Date();
          token.isUpdating = true;

          token.save(rarity.slice(1, cb));
        },
        function callUpdateAccount(cb) {
          var queues = {};

          Object.keys(workers).forEach(function(name) {
            queues[name] = [];
          });

          updateAccount(token.data || {}, (req.params.identifier) ? null : token.cursor, queues, function(err, newCursor, providerData) {
            cb(err, queues, newCursor, providerData);
          });
        },
        function updateToken(queues, newCursor, providerData, cb) {
          if (req.params.identifier) {
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
        function executeQueue(queues, cb) {
          Object.keys(workers).forEach(function(name) {
            // The limit is applied for each queue. (For Anyfetch's providers, queues are addition and deletion)
            var documentsCount = 0;
            console.log("User `" + token.accountName + "` pushed " + queues[name].length + " tasks onto queue `" + name + "`");
            queues[name].every(function(task) {
              if(documentsCount < req.params.documents_per_update && (!req.params.identifier || task.identifier === req.params.identifier)) {
                if (req.params.identifier) {
                  console.log("Reproviding", task.title, "(", task.identifier, ")");
                }

                task._anyfetchToken = token.anyfetchToken;
                task._anyfetchApiUrl = req.params.api_url;
                queue.create(name, task).save();
                documentsCount += 1;
                return true;
              }
              return (req.params.identifier) ? true : false;
            });
          });
          cb(null);
        }
      ], function(err) {
        if(err) {
          console.warn('ERR:', err);
        }
      });
    });
  };
};
