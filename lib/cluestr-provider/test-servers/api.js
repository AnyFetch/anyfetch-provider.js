'use strict';

var restify = require('restify');

module.exports = function() {
  // Create a fake HTTP server
  var apiServer = restify.createServer();
  apiServer.use(restify.acceptParser(apiServer.acceptable));
  apiServer.use(restify.queryParser());
  apiServer.use(restify.bodyParser());

  apiServer.post('/providers/documents', function(req, res, next) {
    if(!req.params.identifier) {
      return next(new restify.MissingParameterError("Specify identifier parameter."));
    }

    res.send(200, req.params);
    next();
  });

  apiServer.del('/providers/documents', function(req, res, next) {
    if(!req.params.identifier) {
      return next(new restify.MissingParameterError("Specify identifier parameter."));
    }
    
    res.send(204);
    next();
  });

  apiServer.post('/providers/documents/file', function(req, res, next) {
    if(!req.params.identifier) {
      return next(new restify.MissingParameterError("Specify identifier parameter."));
    }
    
    res.send(204);
    next();
  });

  return apiServer;
};
