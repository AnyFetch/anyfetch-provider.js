'use strict';
/**
 * @file Reprovide one document from an account with specified access_token and identifier
 *
 */

var async = require('async');
var restify = require('restify');

var Token = require('../models/token.js');


/**
 * This handler downloads data for the specified access_token and starts upload the document with the good identifier onto AnyFetch.
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
    if(!req.params.identifier) {
      console.warn("ERR: Missing identifier parameter.");
      return next(new restify.MissingParameterError("Missing identifier parameter."));
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
        function callUpdateAccount(cb) {
          console.log("Try to retrieve document with identifier : " + req.params.identifier);

          var queues = {};

          Object.keys(workers).forEach(function(name) {
            queues[name] = [];
          });

          updateAccount(token.data || {}, null, queues, function(err) {
            cb(err, queues);
          });
        },
        function executeQueue(queues, cb) {
          var found = false;

          Object.keys(workers).forEach(function(name) {
            found = queues[name].some(function(task) {
              if(task.identifier === req.params.identifier) {
                task._anyfetchToken = token.anyfetchToken;
                task._anyfetchApiUrl = req.params.api_url;

                console.log("Document found with identifier : " + req.params.identifier);
                queue.create(name, task).save();

                return true;
              }
              return false;
            }) || found;
          });

          if(!found) {
            console.log("Document not found with identifier : " + req.params.identifier);
          }

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
