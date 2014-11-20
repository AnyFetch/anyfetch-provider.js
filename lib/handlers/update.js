'use strict';
/**
 * @file Update an account from specified access_token
 *
 */

var async = require('async');
var rarity = require('rarity');
var restify = require('restify');

var util = require('../util.js');

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
      console.log("Token for update", JSON.stringify(req.token));
    }

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
        if(req.params.identifier) {
          return cb(null);
        }

        req.token.lastUpdate = new Date();
        req.token.isUpdating = true;

        req.token.save(rarity.slice(1, cb));
      },
      function createUpdateJob(cb) {
        // This queue manage a unique user and contain a update task which will put different tasks on it
        var userQueue = yaqsClient.createQueue(req.token.accountName, {concurrency: config.concurrency || 1});

        userQueue.createJob({
          type: 'update',
          anyfetchToken: req.token.anyfetchToken,
          params: req.params
        }).save(cb);
      },
      function createUserJob(cb) {
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
