'use strict';

var restify = require('restify');
var autoload = require('auto-load');
var session = require('client-sessions');
var async = require('async');
var http = require('http');
var https = require('https');
var yaqs = require('yaqs');
var Logger = require("bunyan");
var restifyBunyanLogger = require('restify-bunyan-logger');

var Token = require('./models/token.js');
var TempToken = require('./models/temp-token.js');
var util = require('./util.js');

var usersQueue = require('./queues/users-queue.js');


// Create bunyan logger
module.exports.log = new Logger.createLogger({
  name: process.env.APP_NAME || 'provider',
});


/**
* Simple wrapper around the token model.
* Only one token should match.
*
* retrieveData({accessToken: ...}) => data for this access token
* retrieveData({'data.grant': ...}) => data with this value of grant.
*/
module.exports.retrieveData = function(hash, cb) {
  Token.findOne(hash, function(err, token) {
    if(!token) {
      return cb(new Error("no data matches"));
    }
    cb(err, token.data);
  });
};

/**
 * Create a new provider server.
 * This server will use `config.task_generator` as its main function, to turn a file into metadata.
 *
 * @param {Object} config Configuration hash.
 *   Mandatory:
 *      task_generator, to retrieve a list of tasks (a task is "a document to upload").
 *      task_handler, the uploading function.
 *   Optional:
 *      concurrency, max number of simultaneous calls to your task_handler function (default is 1)
 */
module.exports.createServer = function createServer(connectFunctions, workersFile, updateFile, config) {
  ['appId', 'appSecret', 'providerUrl'].forEach(function(name) {
    if(!config[name]) {
      console.warn('Error: Missing config.' + name + ' not found');
      process.exit(1);
    }
  });
  util.logError.config = config;

  if(config.opbeat && config.opbeat.secretToken) {
    var opbeat = require('opbeat');
    util.logError.opbeat = opbeat(config.opbeat);
  }

  // Connect mongo
  util.connectMongo(config.mongoUrl);

  // Load endpoints generators
  var handlers = autoload(__dirname + "/handlers");
  var middlewares = autoload(__dirname + "/middlewares");

  http.globalAgent.maxSockets = config.maxSockets || 30;
  https.globalAgent.maxSockets = http.globalAgent.maxSockets;

  // Create server
  var server = restify.createServer({
    log: module.exports.log
  });


  server.on('after', restifyBunyanLogger({
    skip: function(req) {
      return req.path() === "/status";
    },
    custom: function(req, res, route, err, log) {
      log.req.user = req.token ? req.token.accountName : null;
      return log;
    }
  }));

  server.use(restify.requestLogger());
  server.use(restify.acceptParser(server.acceptable));
  server.use(restify.queryParser());
  server.use(restify.bodyParser());
  server.use(session({
    cookieName: 'ANYFETCH_SESSION',
    secret: config.appSecret
  }));

  config.redisUrl = config.redisUrl || process.env.REDIS_URL || "redis://localhost";

  if(module.exports.yaqsClient) {
    server.yaqsClient = module.exports.yaqsClient;
  }
  else {
    server.yaqsClient = yaqs({
      prefix: config.appName || config.providerUrl,
      redis: config.redisUrl
    });

    module.exports.yaqsClient = server.yaqsClient;
  }

  server.usersQueue = server.yaqsClient.createQueue('anyfetch-provider-users', {
    concurrency: config.usersConcurrency || 1,
    defaultTimeout: -1
  });

  server.childs = {};

  function sigtermYaqs() {
    async.waterfall([
      function killProcesses(cb) {
        async.each(Object.keys(server.childs), function(anyfetchToken, cb) {
          server.childs[anyfetchToken].kill(cb);
        }, cb);
      },
      function stopAllQueues(cb) {
        server.yaqsClient.stopAllQueues(cb);
      },
      function registerUsers(cb) {
        async.each(Object.keys(server.childs), function(anyfetchToken, cb) {
          server.usersQueue.createJob({
            anyfetchToken: anyfetchToken,
            anyfetchApiUrl: server.childs[anyfetchToken].anyfetchApiUrl
          }).save(cb);
        }, cb);
      }
    ], function(err) {
      module.exports.log.info('YAQS has stopped.');

      util.logError(err);
      process.exit(0);
    });
  }

  process.once('SIGTERM', sigtermYaqs);

  server.usersQueue
    .on('error', util.logError)
    .setWorker(usersQueue(server, config, workersFile, updateFile))
    .start();

  // Load routes and generate endpoints using closures
  server.get('/', handlers.index.get);
  server.get('/init/connect', handlers.init.connect.getGenerator(connectFunctions.redirectToService, config));
  server.get('/init/callback', handlers.init.callback.getGenerator(connectFunctions.retrieveTokens, config));

  server.post('/update', middlewares.token, handlers.update.postGenerator(server.yaqsClient, server.usersQueue, config));
  server.post('/update/:identifier', middlewares.token, handlers.update.postGenerator(server.yaqsClient, server.usersQueue, config));

  server.get('/status', handlers.status.get);

  server.post('/token', handlers.token.index.post);
  server.del('/token', middlewares.token, handlers.token.index.del);
  server.del('/token/reset', middlewares.token, handlers.token.reset.del);

  server.on('uncaughtException', function(req, res, route, err) {
    util.logError(err, req);

    if(!res._headerSent) {
      res.send(new restify.InternalServerError(err, err.message || 'unexpected error'));
      return true;
    }

    return false;
  });

  module.exports.currentServer = server;

  // Expose the server
  return server;
};

module.exports.debug = {
  cleanTokens: function(cb) {
    util.connectMongo();
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
    util.connectMongo();

    var token = new Token(hash);
    token.save(cb);
  },
  createTempToken: function(hash, cb) {
    util.connectMongo();

    var tempToken = new TempToken(hash);
    tempToken.save(cb);
  }
};

module.exports.CancelError = util.CancelError;
module.exports.TokenError = util.TokenError;
module.exports.util = util;
