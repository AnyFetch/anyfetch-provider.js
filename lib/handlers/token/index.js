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
    function sendResponse(token, cb) {
      res.send(204);
      cb(null);
    }
  ], next);
};
