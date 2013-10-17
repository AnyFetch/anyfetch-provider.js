'use strict';
/**
 * @file Update an account from specified access_token
 *
 */

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

      res.send(204);
      next();

      updateAccountCb(token.datas, token.cursor, function(err, tasks, newCursor) {
        if(err) {
          console.log("Err retrieving tasks: ", err);
        }
        else if(!newCursor) {
          throw new Error("newCursor not defined.");
        }
        else if(!tasks || !Array.isArray(tasks)) {
          throw new Error("tasks must be an array");
        }
        else {
          var cluestrClient = new CluestrClient(appId, appSecret);
          cluestrClient.setAccessToken(req.params.access_token);

          // Insert the client into each task
          tasks.forEach(function(task) {
            task.cluestrClient = cluestrClient;
          });

          tasks.push({
            _update: true,
            token: token,
            cursor: newCursor
          });

          queue.push(tasks);
        }
      });
    });
  };
};
