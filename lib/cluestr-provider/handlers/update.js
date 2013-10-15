'use strict';
/**
 * @file Update an account from specified access_token
 *
 */

var restify = require('restify');

var Token = require('../models/token.js');


/**
 * This handler downloads datas for the specified access_token and starts uploading them onto Cluestr.
 * 
 * @param {Object} req Request object from the client
 * @param {Object} res Response we want to return
 * @param {Function} next Callback to call once res has been populated.
 */
module.exports = function(updateAccountCb, queue) {
  return function(req, res, next) {
    if(!req.params.access_token) {
      return next(new restify.MissingParameterError("Missing access_token parameter."));
    }

    Token.findOne({cluestrToken: req.params.access_token}, function(err, token) {
      if(err) {
        return next(err);
      }
      if(!token) {
        return next(new Error("Unknown token."));
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
