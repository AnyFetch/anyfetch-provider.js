'use strict';

var AnyFetchClient = require("anyfetch");
var restify = require('restify');
var async = require('async');
var mongoose = require('mongoose');
var domain = require('domain');

var Token = require('./models/token.js');
var TempToken = require('./models/temp-token.js');

var connected = false;
var connectMongo = function() {
  if(!connected) {
    // Connect mongoose
    mongoose.connect(process.env.MONGO_URL || "mongodb://localhost/anyFetch-provider");
    connected = true;
  }
};


/**
 * Check the specified config contains all mandatory keys.
 */
module.exports.validateConfig = function(config) {
  var mandatoryKeys = ['initAccount', 'connectAccountRetrievePreDatasIdentifier', 'connectAccountRetrieveAuthDatas', 'updateAccount', 'queueWorker', 'anyFetchAppId', 'anyFetchAppSecret', 'connectUrl'];

  for(var i = 0; i < mandatoryKeys.length; i += 1) {
    var mandatoryKey = mandatoryKeys[i];
    if(!config[mandatoryKey]) {
      return new Error("Specify `" + mandatoryKey + "` to create server.");
    }
  }
};

/**
 * Simple wrapper around the token model.
 * Only one token should match.
 *
 * retrieveDatas({accessToken: ...}) => datas for this access token
 * retrieveDatas({'datas.grant': ...}) => datas with this value of grant.
 */
module.exports.retrieveDatas = function(hash, cb) {
  Token.findOne(hash, function(err, token) {
    if(!token) {
      return cb("no datas matches");
    }
    cb(err, token.datas);
  });
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

  // Build anyFetchClient to use everywhere for this server.
  var anyFetchClient = new AnyFetchClient(config.anyFetchAppId, config.anyFetchAppSecret);

  // Load endpoints generators
  var initEndpoints = require('./handlers/init.js');
  var updateEndpoint = require('./handlers/update.js');
  var resetEndpoint = require('./handlers/reset.js');

  // Create server
  var server = restify.createServer();
  server.use(restify.acceptParser(server.acceptable));
  server.use(restify.queryParser());
  server.use(restify.bodyParser());

  // Add a queue onto the server
  var queue = function(task, cb) {
    // Check for special finalization task (token update)
    if(task._update) {
      if(task.cursor) {
        task.token.cursor = task.cursor;
        task.token.markModified('cursor');
      }
      
      task.token.isUpdating = false;
      task.token.markModified('isUpdating');
      return task.token.save(cb);
    }

    // Standard tasks
    // Run in domain to avoid failures
    var d = domain.create();
    d.once('error', cb);
    d.run(function() {
      var anyFetchClient = task.anyFetchClient;
      var tokenDatas = task.tokenDatas;
      delete task.anyFetchClient;
      delete task.tokenDatas;
      config.queueWorker(task, anyFetchClient, tokenDatas, cb);
    });
  };
  server.queue = async.queue(queue, config.concurrency || 1);


  // Load routes and generate endpoints using closures
  server.get('/init/connect', initEndpoints.connect(config.initAccount));
  server.get('/init/callback', initEndpoints.callback(config.connectAccountRetrievePreDatasIdentifier, config.connectAccountRetrieveAuthDatas, anyFetchClient, config.connectUrl, config.redirectUrl || 'http://anyFetch.com'));

  server.post('/update', updateEndpoint(config.updateAccount, config.appId, config.appSecret, server.queue));

  server.del('/reset', resetEndpoint);
  
  // Expose the server
  return server;
};


module.exports.debug = {
  createTestFrontServer: AnyFetchClient.debug.createTestFrontServer,
  createTestApiServer: AnyFetchClient.debug.createTestApiServer,
  cleanTokens: function(cb) {
    connectMongo();
    async.parallel([
      function(cb) {
        Token.remove({}, cb);
      },
      function(cb) {
        Token.remove({}, cb);
      }
    ], cb);
  },
  createToken: function(hash, cb) {
    connectMongo();

    var token = new Token(hash);
    token.save(cb);
  },
  createTempToken: function(hash, cb) {
    connectMongo();
    
    var tempToken = new TempToken(hash);
    tempToken.save(cb);
  }
};
