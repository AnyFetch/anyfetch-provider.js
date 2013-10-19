'use strict';

var restify = require('restify');

module.exports = function() {
  // Create a fake HTTP server
  var frontServer = restify.createServer();
  frontServer.use(restify.acceptParser(frontServer.acceptable));
  frontServer.use(restify.queryParser());
  frontServer.use(restify.bodyParser());

  frontServer.post('/oauth/token', function(req, res, next) {
    res.send({access_token: "fake_access_token"});
    next();
  });

  return frontServer;
};
