'use strict';

var restify = require('restify');
var async = require('async');
var mongoose = require('mongoose');
var url = require('url');
var kue = require('kue');
var Anyfetch = require('anyfetch');

var Token = require('./models/token.js');
var TempToken = require('./models/temp-token.js');

var connected = false;
var connectMongo = function(mongoUrl) {
  if(!connected) {
    // Connect mongoose
    mongoose.connect(mongoUrl || process.env.MONGO_URL || "mongodb://localhost/anyfetch-provider");
    connected = true;
  }
};

/**
 * Create a new provider server.
 * This server will use `config.task_generator` as its main function, to turn a file into metadata.
 *
 * @param {Object} config Configuration hash.
 *   Mandatory:
*       task_generator, to retrieve a list of tasks (a task is "a document to upload").
*       task_handler, the uploading function.
*    Optional:
*       concurrency, max number of simultaneous calls to your task_handler function (default is 1)
 */
module.exports.createServer = function createServer(connectFunctions, updateAccount, workers, config) {
  // Connect mongo
  connectMongo(config.mongoUrl);

  // Load endpoints generators
  var indexEndpoint = require('./handlers/index.js');
  var initConnectEndpoints = require('./handlers/init/connect.js');
  var initCallbackEndpoints = require('./handlers/init/callback.js');
  var updateEndpoint = require('./handlers/update.js');
  var statusEndpoint = require('./handlers/status.js');
  var resetEndpoint = require('./handlers/reset.js');

  // Create server
  var server = restify.createServer();
  server.use(restify.acceptParser(server.acceptable));
  server.use(restify.queryParser());
  server.use(restify.bodyParser());

  server.queue = kue.createQueue({
    prefix: config.providerUrl,
    redis: {
      port: (config.redisUrl) ? url.parse(config.redisUrl).port : 6379,
      host: (config.redisUrl) ? url.parse(config.redisUrl).hostname : "localhost"
    },
    disableSearch: true
  });

  Object.keys(workers).forEach(function createQueue(name) {
    server.queue.process(name, (workers[name].concurrency) ? workers[name].concurrency : 1, function(job, done) {
      job.task = job.data;

      job.anyfetchClient = new Anyfetch(job.task.anyfetchToken);

      Token.findOne({anyfetchToken: job.task.anyfetchToken}, function(err, token) {
        if(err) {
          done(err);
        }

        job.serviceData = token.data;

        delete job.data;
        delete job.task.anyfetchToken;

        workers[name](job, done);
      });
    });
  });

  // Load routes and generate endpoints using closures
  server.get('/', indexEndpoint);
  server.get('/init/connect', initConnectEndpoints(connectFunctions.redirectToService, config));
  server.get('/init/callback', initCallbackEndpoints(connectFunctions.retrieveTokens, config));

  server.post('/update', updateEndpoint(updateAccount, server.queue, workers));

  server.get('/status', statusEndpoint);
  server.del('/reset', resetEndpoint);

  // Expose the server
  return server;
};

module.exports.debug = {
  cleanTokens: function(cb) {
    connectMongo();
    async.parallel([
      function(cb) {
        Token.remove({}, cb);
      },
      function(cb) {
        TempToken.remove({}, cb);
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
