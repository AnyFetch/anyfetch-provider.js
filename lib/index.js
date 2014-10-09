'use strict';

var restify = require('restify');
var autoload = require('auto-load');
var session = require('client-sessions');
var async = require('async');
var rarity = require('rarity');
var mongoose = require('mongoose');
var url = require('url');
var kue = require('kue');
var http = require('http');
var https = require('https');
var Anyfetch = require('anyfetch');
var lru = require('lru-cache');

var Token = require('./models/token.js');
var TempToken = require('./models/temp-token.js');
var util = require('./util.js');
var logger = require('./middlewares/logger.js');

var connected = false;
var connectMongo = function(mongoUrl) {
  if(!connected) {
    // Connect mongoose
    mongoose.connect(mongoUrl || process.env.MONGO_URL || "mongodb://localhost/anyfetch-provider");
    connected = true;
  }
};

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
module.exports.createServer = function createServer(connectFunctions, updateAccount, workers, config) {
  ['appId', 'appSecret', 'providerUrl'].forEach(function(name) {
    if(!config[name]) {
      console.warn('Error: Missing config.' + name + ' not found');
      process.exit(1);
    }
  });

  util.logError.config = config;

  if(config.opbeat && config.opbeat.secret_token) {
    var opbeat = require('opbeat');
    util.logError.opbeat = opbeat.createClient(config.opbeat);
  }

  // Connect mongo
  connectMongo(config.mongoUrl);

  // Load endpoints generators

  var handlers = autoload(__dirname + "/handlers");
  var middlewares = autoload(__dirname + "/middlewares");

  http.globalAgent.maxSockets = config.maxSockets || 30;
  https.globalAgent.maxSockets = http.globalAgent.maxSockets;

  // Create server
  var server = restify.createServer();
  server.use(restify.acceptParser(server.acceptable));
  server.use(restify.queryParser());
  server.use(restify.bodyParser());
  server.use(session({
    cookieName: 'ANYFETCH_SESSION',
    secret: config.appSecret
  }));
  server.use(middlewares.logger);

  var components = url.parse(config.redisUrl || process.env.REDIS_URL || "redis://localhost");
  server.queue = kue.createQueue({
    prefix: config.providerUrl,
    redis: {
      port: components.port || 6379,
      host: components.hostname || "localhost",
      auth: (components.auth) ? ((components.auth.split(':').length > 1) ? components.auth.split(':')[1] : components.auth) : undefined,
      options: {
        no_ready_check: true
      }
    },
    disableSearch: true
  });

  function sigtermKue() {
    server.queue.shutdown(function(err) {
      console.log('Kue has stopped successfully.', err || '');
      process.exit(0);
    }, 5000);
  }

  process.once('SIGTERM', sigtermKue);

  // One element have a length of '1', so we can stock 50 elements
  server.tokenCache = lru({
    max: 50,
    length: function () { return 1; },
    maxAge: 60 * 60 * 1000
  });

  server.userCache = lru({
    max: 50,
    length: function () { return 1; },
    maxAge: 60 * 60 * 1000
  });

  function executeJob(job, done, ctx) {
    async.waterfall([
      function retrieveToken(cb) {
        if(server.tokenCache.has(job.data._anyfetchToken)) {
          cb(null, server.tokenCache.get(job.data._anyfetchToken));
        }
        else {
          Token.findOne({anyfetchToken: job.data._anyfetchToken}).lean().exec(rarity.slice(2, cb));
        }
      },
      function executeTask(token, cb) {
        if(!token) {
          return cb(null);
        }

        console.log("User `" + token.accountName + "` is executing task " + job.id + " of queue `" + job.type + "`");

        if(!token.anyfetchClient) {
          token.anyfetchClient = new Anyfetch(job.data._anyfetchToken);
          token.anyfetchClient.setApiUrl(job.data._anyfetchApiUrl);
        }

        job.anyfetchClient = token.anyfetchClient;
        server.tokenCache.set(job.data._anyfetchToken, token);

        job.task = job.data;
        job.serviceData = token.data;
        job.cache = server.userCache;
        job.ctx = ctx;

        // We use task instead of data
        job.data = null;
        job.task._anyfetchToken = null;
        job.task._anyfetchApiUrl = null;

        workers[job.type](job, cb);
      }
    ], function(err) {
      if(err) {
        console.log("Job " + job.id + " of queue `" + job.type + "` failed");
        util.logError(err, {jobId: job.id, jobTask: job.task, jobType: job.type, jobServiceData: job.serviceData});
      }

      job = null;
      done(err);
    });
  }

  Object.keys(workers).forEach(function createQueue(name) {
    server.queue.process(name, (workers[name].concurrency) ? workers[name].concurrency : 1, executeJob);
  });

  // Load routes and generate endpoints using closures
  server.get('/', handlers.index.get);
  server.get('/init/connect', handlers.init.connect.getGenerator(connectFunctions.redirectToService, config));
  server.get('/init/callback', handlers.init.callback.getGenerator(connectFunctions.retrieveTokens, config));

  server.post('/update', middlewares.token, handlers.update.postGenerator(updateAccount, server.queue, workers, config));
  server.post('/update/:identifier', middlewares.token, handlers.update.postGenerator(updateAccount, server.queue, workers, config));

  server.get('/status', middlewares.token, handlers.status.get);

  server.post('/token', handlers.token.index.post);
  server.del('/token', middlewares.token, handlers.token.index.del);
  server.del('/token/reset', middlewares.token, handlers.token.reset.del);

  server.on('uncaughtException', function(req, res, route, err) {
    console.warn('ERR: uncaughtException in restify server', err);

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

module.exports.CancelError = require('./cancel-error.js');
module.exports.util = util;
