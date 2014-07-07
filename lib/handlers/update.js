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
      if(token.isUpdating) {
        return next(new restify.TooManyRequests('Already processing'));
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

          token.save(cb);
        },
        function callUpdateAccount(cb) {
          var queues = {};

          Object.keys(workers).forEach(function(name) {
            queues[name] = {
              push: function(task) {
                task.anyfetchToken = token.anyfetchToken;
                queue.create(name, task).save();
              }
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
          }
          token.cursor = newCursor;
          token.markModified('cursor');
          token.isUpdating = false;
          token.markModified('isUpdating');

          token.save(cb);
        }
      ], function(err) {
        if(err) {
          console.log('ERR:', err);
        }
      });
    });
  };
};
