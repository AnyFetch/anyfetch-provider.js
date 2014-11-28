'use strict';

var restify = require('restify');
var async = require('async');
var rarity = require('rarity');

var Token = require('../../models/token.js');

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

module.exports.del = function tokenDel(req, res, next) {
  var server = require('../../index.js').currentServer;

  async.waterfall([
    function removeToken(cb) {
      if(server) {
        server.tokenCache.del(req.token.anyfetchToken);
      }

      req.token.remove(cb);
    },
    function killChilds(token, cb) {
      if(server.childs[req.token.anyfetchToken]) {
        return server.childs[req.token.anyfetchToken].kill(rarity.carry([token], cb));
      }

      cb(null, token);
    },
    function removeChildsAndQueue(token, cb) {
      if(server.childs[req.token.anyfetchToken]) {
        var queue = server.childs[req.token.anyfetchToken].queue;
        delete server.childs[req.token.anyfetchToken];

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
