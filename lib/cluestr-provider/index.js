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
  var mandatoryKeys = ['new_account', 'new_account_connected', 'task_generator', 'task_handler'];

  mandatoryKeys.forEach(function(mandatory_key) {
    if(!config[mandatory_key]) {
      throw new Error("Specify `" + mandatory_key + "`");
    }
  });

  // Load configuration and initialize server
  var restify = require('restify');
  var async = require('async');

  var initEndpoints = require('./handlers/init.js');
  var updateEndpoints = require('./handlers/update.js')(config.task_generator, config.task_handler);
  var queueHelper = require('./helpers/queue.js');

  var server = restify.createServer();

  // Middleware Goes Here
  server.use(restify.acceptParser(server.acceptable));
  server.use(restify.queryParser());
  server.use(restify.bodyParser());

  server.queue = async.queue(queueHelper, config.concurrency || 1);


  // Load routes
  server.get('/init/connect', initEndpoints.connect);
  server.get('/init/callback', initEndpoints.callback);

  server.get('/update', updateEndpoints.callback);

  // Expose the server
  return server;
};

