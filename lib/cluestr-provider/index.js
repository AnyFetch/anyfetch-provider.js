'use strict';

var CluestrClient = require("cluestr");
var restify = require('restify');
var async = require('async');
var mongoose = require('mongoose');

var connected = false;
var connectMongo = function() {
  if(!connected) {
    // Connect mongoose
    mongoose.connect(process.env.MONGO_URL || "mongodb://localhost/cluestr-provider");
    connected = true;
  }
};


/**
 * Check the specified config contains all mandatory keys.
 */
module.exports.validateConfig = function(config) {
  var mandatoryKeys = ['initAccount', 'connectAccountRetrievePreDatasIdentifier', 'connectAccountRetrieveAuthDatas', 'updateAccount', 'queueWorker', 'cluestrAppId', 'cluestrAppSecret', 'connectUrl'];

  for(var i = 0; i < mandatoryKeys.length; i += 1) {
    var mandatoryKey = mandatoryKeys[i];
    if(!config[mandatoryKey]) {
      return new Error("Specify `" + mandatoryKey + "` to create server.");
    }
  }
};


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
  var err = module.exports.validateConfig(config);
  if(err) {
    throw err;
  }

  // Connect mongo
  connectMongo();

  // Build cluestrClient to use everywhere for this server.
  var cluestrClient = new CluestrClient(config.cluestrAppId, config.cluestrAppSecret);

  // Load endpoints generators
  var initEndpoints = require('./handlers/init.js');
  var updateEndpoints = require('./handlers/update.js');

  // Create server
  var server = restify.createServer();
  server.use(restify.acceptParser(server.acceptable));
  server.use(restify.queryParser());
  server.use(restify.bodyParser());

  // Add a queue onto the server
  var queue = function(task, cb) {
    // Check for special tasks (token update)
    if(task._update) {
      task.token.cursor = task.cursor;
      task.token.markModified('cursor');
      task.token.save(cb);
    }
    else {
      task.cluestrClient = cluestrClient;
      config.queueWorker(task, cb);
    }
  };
  server.queue = async.queue(queue, config.concurrency || 1);


  // Load routes and generate endpoints using closures
  server.get('/init/connect', initEndpoints.connect(config.initAccount));
  server.get('/init/callback', initEndpoints.callback(config.connectAccountRetrievePreDatasIdentifier, config.connectAccountRetrieveAuthDatas, cluestrClient, config.connectUrl, config.redirectUrl || 'http://cluestr.com'));

  server.post('/update', updateEndpoints(config.updateAccount, config.appId, config.appSecret, server.queue));

  // Expose the server
  return server;
};

