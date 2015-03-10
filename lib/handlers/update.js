'use strict';
/**
 * @file Update an account from specified access_token
 *
 */

var async = require('async');
var rarity = require('rarity');
var restify = require('restify');

var util = require('../util.js');
var log = require('../index.js').log;

/**
 * This handler downloads data for the specified access_token and starts uploading them onto AnyFetch.
 *
 */
module.exports.postGenerator = function postGenerator(yaqsClient, queue, config) {
  return function updatePost(req, res, next) {
    if(!req.params.documents_per_update && !req.params.identifier) {
      return next(new restify.MissingParameterError("Missing documents_per_update parameter."));
    }

    if(process.env.NODE_ENV !== "test") {
      log.info({
        anyfetchToken: req.token.anyfetchToken,
        lastUpdate: req.token.lastUpdate,
        accountName: req.token.accountName
      }, "Updating token");
    }

    if(req.token.requireRefresh) {
      return next(new restify.PreconditionRequiredError("Token require a refresh"));
    }
    // Skip task if token is already updating
    // Special case: if the token has been locked for more than 5 minutes, dispay a warning (probable crash) and force-unlock it.
    else if(req.token.isUpdating && !req.params.force) {
      if(Date.now() - req.token.lastUpdate.getTime() < 5 * 3600 * 1000) {
        log.warn(req.token, "Already processing");
        return next(new restify.TooManyRequestsError('Already processing'));
      }
      else {
        log.warn(req.token, "Retrying providing after potential crash");
        res.send(202);
      }
    }
    else {
      res.send(202);
    }
    next();

    async.waterfall([
      function updateToken(cb) {
        // Identifier can be specified to reprovide only one item.
        // This is not performant, and should only be use for debug purposes.
        if(req.params.identifier) {
          return cb(null);
        }

        req.token.lastUpdate = new Date();
        req.token.isUpdating = true;

        req.token.save(rarity.slice(1, cb));
      },
      function createUpdateJob(cb) {
        // This queue manage a unique user.
        // For now it will only contain an update task, later it will be populated with all the tasks to execute for the current user.
        var userQueue = yaqsClient.createQueue(req.token.accountName, {concurrency: config.concurrency || 1});

        userQueue.createJob({
          type: 'update',
          anyfetchToken: req.token.anyfetchToken,
          params: req.params
        }).save(cb);
      },
      function createUserJob(cb) {
        // Register the job to be handled later (by anyone subscribed to Redis, probably not on this server)
        queue.createJob({
          anyfetchToken: req.token.anyfetchToken,
          anyfetchApiUrl: req.params.api_url || process.env.API_URL || "https://api.anyfetch.com"
        }).save(cb);
      }
    ], function(err) {
      util.logError(err, req, {params: req.params, token: req.token});
    });
  };
};
