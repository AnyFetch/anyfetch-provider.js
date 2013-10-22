'use strict';
/**
 * @file Update an account from specified access_token
 *
 */

var async = require('async');
var restify = require('restify');
var CluestrClient = require('cluestr');

var Token = require('../models/token.js');


/**
 * This handler downloads datas for the specified access_token and starts uploading them onto Cluestr.
 * 
 * @param {Object} req Request object from the client
 * @param {Object} res Response we want to return
 * @param {Function} next Callback to call once res has been populated.
 */
module.exports = function(updateAccountCb, appId, appSecret, queue) {
  return function(req, res, next) {
    if(!req.params.access_token) {
      return next(new restify.MissingParameterError("Missing access_token parameter."));
    }

    Token.findOne({cluestrToken: req.params.access_token}, function(err, token) {
      if(err) {
        return next(err);
      }
      if(!token) {
        return next(new restify.MissingParameterError("Unknown token."));
      }
      if(token.isUpdating) {
        res.send(204);
        return next();
      }

      res.send(202);
      next();
      

      async.waterfall([
        function(cb) {
          // Update token
          token.lastUpdate = new Date();
          token.isUpdating = true;

          token.save(function(err) {
            cb(err);
          });
        },
        function(cb) {
          updateAccountCb(token.datas, token.cursor, cb);
        },
        function(tasks, newCursor, cb) {
          if(!newCursor) {
            throw new Error("newCursor not defined.");
          }
          else if(!tasks || !Array.isArray(tasks)) {
            throw new Error("tasks must be an array");
          }
          else {
            var cluestrClient = new CluestrClient(appId, appSecret);
            cluestrClient.setAccessToken(req.params.access_token);

            // Insert the client and datas into each task
            tasks.forEach(function(task) {
              task.cluestrClient = cluestrClient;
              task.tokenDatas = token.datas;
            });

            // Insert finalization task
            tasks.push({
              _update: true,
              token: token,
              cursor: newCursor
            });

            queue.push(tasks);

            cb();
          }
        }
      ]);
    });
  };
};
