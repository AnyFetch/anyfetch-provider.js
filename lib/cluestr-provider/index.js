'use strict';

/**
 * Create a new provider server.
 * This server will use `config.task_generator` as its main function, to turn a file into metadatas.
 *
 * @param {Object} config Configuration hash.
 *   Mandatory:
*       task_generator, to retrieve a list of tasks (a task is "a document to upload").
*       task_handler, the uploading function.
*    Optional:
*       concurrency, max number of simultaneous calls to your task_handler function (default is 1)
 */
module.exports.createServer = function(config) {
  if(!config.task_generator) {
    throw new Error("Specify `task_generator`");
  }

  if(!config.task_handler) {
    throw new Error("Specify `task_handler`");
  }

  // Load configuration and initialize server
  var restify = require('restify');
  var async = require('async');

  var hydraterEndpoint = require('./handlers/hydrater.js');
  var hydraterHelper = require('./helpers/hydrater.js')(config.hydrater_url, config.hydrater_function);
  var server = restify.createServer();


  // Middleware Goes Here
  server.use(restify.acceptParser(server.acceptable));
  server.use(restify.queryParser());
  server.use(restify.bodyParser());

  server.queue = async.queue(hydraterHelper, config.concurrency || 1);


  // Load routes
  server.post('/hydrate', function(req, res, next) {
    hydraterEndpoint(req, res, server, next);
  });

  // Expose the server
  return server;
};

