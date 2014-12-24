'use strict';

var restify = require('restify');
var async = require('async');
var rarity = require('rarity');

var Token = require('../../models/token.js');

/**
 * Create a new token.
 * Rarely used, but can be useful for debug to reset a cursor or update accountName.
 */
module.exports.post = function tokenPost(req, res, next) {
  if(!req.params.access_token) {
    return next(new restify.MissingParameterError("Missing access_token parameter."));
  }

  var token = new Token({
    anyfetchToken: req.params.access_token,
    data: req.params.data || {},
    cursor: req.params.cursor || null,
    accountName: req.params.account_name || 'accountName'
  });

  async.waterfall([
    function saveToken(cb) {
      token.save(rarity.slice(2, cb));
    },
    function sendResponse(token, cb) {
      res.send(204);
      cb(null);
    }
  ], next);
};


/**
 * Remove a token.
 * Stop all pending tasks currently running on this token
 */
module.exports.del = function tokenDel(req, res, next) {
  var server = require('../../index.js').currentServer;

  async.waterfall([
    function removeToken(cb) {
      if(server) {
        server.tokenCache.del(req.token.anyfetchToken);
      }

      // Remove the token from Mongo
      req.token.remove(cb);
    },
    function killChilds(token, cb) {
      if(server.childs[req.token.anyfetchToken]) {
        // Kill any process currently working on this token's tasks
        return server.childs[req.token.anyfetchToken].kill(rarity.carry([token], cb));
      }

      cb(null, token);
    },
    function removeChildsAndQueue(token, cb) {
      if(server.childs[req.token.anyfetchToken]) {
        var queue = server.childs[req.token.anyfetchToken].queue;

        // Remove the child (they've been asked to stop before)
        delete server.childs[req.token.anyfetchToken];

        // Remove any pending items in Redis
        return queue.remove(rarity.carry([token], cb));
      }

      cb(null, token);
    },
    function sendResponse(token, cb) {
      res.send(204);
      cb(null);
    }
  ], next);
};
