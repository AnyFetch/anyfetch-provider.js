'use strict';

require('should');
var request = require('supertest');
var async = require('async');
var AnyFetch = require('anyfetch');

var AnyFetchProvider = require('../lib/');
var TempToken = require('../lib/models/temp-token.js');
var Token = require('../lib/models/token.js');

var accessGrant = "fakeAccessGrant";


var initAccount = function(req, next) {
  var preData = {
    accessGrant: accessGrant
  };
  next(null, preData, 'http://localhost');
};

var connectAccountRetrievePreDataIdentifier = function(req, next) {
  // Retrieve temp token
  next(null, {'data.accessGrant': accessGrant});
};

var connectAccountRetrieveAuthData = function(req, preData, next) {
  var data = preData.accessGrant + "_accessToken";
  next(null, data);
};

var updateAccount = function(data, cursor, next) {
  // Update the account !
  next(null, [], new Date());
};

var queueWorker = function(task, anyfetchClient, data, cb) {
  // Upload document
  cb();
};

var config = {};
var resetConfig = function() {
  // Reset config to pristine state
  config = {
    initAccount: initAccount,
    connectAccountRetrievePreDataIdentifier: connectAccountRetrievePreDataIdentifier,
    connectAccountRetrieveAuthData: connectAccountRetrieveAuthData,
    updateAccount: updateAccount,
    queueWorker: queueWorker,

    anyfetchAppId: 'appId',
    anyfetchAppSecret: 'appSecret',
    connectUrl: 'http://localhost:1337/init/connect'
  };
};


describe("AnyFetchProvider.createServer() config", function() {
  beforeEach(resetConfig);

  it("should validate correct config", function(done) {
    var ret = AnyFetchProvider.validateConfig(config);

    if(ret) {
      throw new Error("No error should be returned");
    }

    done();
  });

  it("should err on missing handler", function(done) {
    delete config.initAccount;
    AnyFetchProvider.validateConfig(config).toString().should.include('Specify `initAccount');
    done();
  });

  it("should err on missing parameter", function(done) {
    delete config.anyfetchAppId;
    AnyFetchProvider.validateConfig(config).toString().should.include('Specify `anyfetchAppId');
    done();
  });
});


describe("AnyFetchProvider.createServer()", function() {
  beforeEach(resetConfig);

  describe('/ endpoint', function() {
    it("should redirect to anyfetch.com", function(done) {
      var server = AnyFetchProvider.createServer(config);

      request(server).get('/')
        .expect(302)
        .expect('Location', 'http://anyfetch.com')
        .end(done);
    });
  });

  describe("/init endpoints", function() {
    beforeEach(AnyFetchProvider.debug.cleanTokens);

    it("should require anyfetch code", function(done) {
      var server = AnyFetchProvider.createServer(config);

      request(server).get('/init/connect')
        .expect(409)
        .end(done);
    });

    it("should store data returned by initAccount() in TempToken", function(done) {
      var initAccount = function(req, next) {
        var preData = {
          "foo": "bar"
        };

        next(null, preData, 'http://localhost');
      };

      config.initAccount = initAccount;

      var server = AnyFetchProvider.createServer(config);

      request(server).get('/init/connect?code=anyfetch_code')
        .expect(302)
        .end(function(err) {
          if(err) {
            throw err;
          }

          TempToken.findOne({'data.foo': 'bar'}, function(err, tempToken) {
            if(err) {
              return done(err);
            }

            tempToken.should.have.property('anyfetchCode', 'anyfetch_code');

            done();
          });

        });
    });

    it("should retrieve data on TempToken", function(done) {
      // Fake AnyFetch server handling access token scheme
      process.env.ANYFETCH_SETTINGS_URL = 'http://localhost:1337';

      // Create a fake HTTP server
      var frontServer = AnyFetch.debug.createTestFrontServer();
      frontServer.listen(1337);

      var originalPreData = {
        'key': 'retrieval',
        'something': 'data'
      };

      async.series([
        function(cb) {
          // Fake a call to /init/connect returned this data
          var tempToken = new TempToken({
            anyfetchCode: 'anyfetch_token',
            data: originalPreData
          });

          tempToken.save(cb);
        },
        function(cb) {
          var connectAccountRetrievePreDataIdentifier = function(req, next) {
            // Retrieve temp token
            next(null, {'data.key': req.params.code});
          };

          var connectAccountRetrieveAuthData = function(req, preData, next) {
            preData.should.eql(originalPreData);
            next(null, {
              'final': 'my-code'
            });
          };

          config.connectAccountRetrievePreDataIdentifier = connectAccountRetrievePreDataIdentifier;
          config.connectAccountRetrieveAuthData = connectAccountRetrieveAuthData;

          var server = AnyFetchProvider.createServer(config);

          request(server).get('/init/callback?code=retrieval')
            .expect(302)
            .end(function(err) {
            if(err) {
              throw err;
            }

            Token.findOne({'data.final': 'my-code'}, function(err, token) {
              if(err) {
                return cb(err);
              }

              if(!token) {
                throw new Error("Token should be saved.");
              }

              cb();
            });
          });
        }
      ], done);
    });
  });

  describe("/update endpoint", function() {
    var updateServer = function(server, done) {
      if(!done) {
        done = function(err) {
          if(err) {
            throw err;
          }
        };
      }

      request(server).post('/update')
        .send({
          access_token: 'thetoken',
          api_url: 'http://api.anyfetch.com'
        })
        .expect(202)
        .end(done);
    };

    var token;

    beforeEach(AnyFetchProvider.debug.cleanTokens);
    beforeEach(function(done) {
      // Create a token, as-if /init/ workflow was properly done
      token = new Token({
        anyfetchToken: 'thetoken',
        data: {
          foo: 'bar'
        }
      });

      token.save(done);
    });


    it("should require access_token to update", function(done) {
      var server = AnyFetchProvider.createServer(config);

      request(server)
        .post('/update')
        .send({
          api_url: process.env.ANYFETCH_SETTINGS_URL
        })
        .expect(409)
        .expect(/access_token/)
        .end(done);
    });


    it("should require access_token to update", function(done) {
      var server = AnyFetchProvider.createServer(config);

      request(server)
        .post('/update')
        .send({
          access_token: '123'
        })
        .expect(409)
        .expect(/api_url/)
        .end(done);
    });

    it("should require valid access_token to update", function(done) {
      var server = AnyFetchProvider.createServer(config);

      request(server)
        .post('/update')
        .send({
          access_token: 'dummy_access_token',
          api_url: 'http://api.anyfetch.com'
        })
        .expect(409)
        .end(done);
    });


    it("should disable updating while updating", function(done) {
      var server = AnyFetchProvider.createServer(config);
      server.listen(8745);
      updateServer(server, function(err) {
        if(err) {
          throw err;
        }

        request(server)
          .post('/update')
          .send({
            access_token: token.anyfetchToken,
            api_url: 'http://api.anyfetch.com'
          })
          .expect(204)
          .expect(function() {
            server.close();
          })
          .end(done);
      });
    });

    it("should restart update if status is updating but the queue is empty", function(done) {
      var server = AnyFetchProvider.createServer(config);

      async.waterfall([
        // Simulate a crash (isUpdating to true, queue empty)
        function updateToken(cb) {
          token.isUpdating = true;
          token.save(cb);
        },
        function sendUpdate(token, count, cb) {
          request(server)
            .post('/update')
            .send({
              access_token: token.anyfetchToken,
              api_url: 'http://api.anyfetch.com'
            })
            .expect(202)
            .expect('X-Restart-Forced', 'true')
            .end(cb);
        },
      ], done);
    });

    it("should reenable updating after failure", function(done) {
      config.queueWorker = function() {
        throw new Error("Lol.");
      };

      var server = AnyFetchProvider.createServer(config);

      updateServer(server, function(err) {
        if(err) {
          throw err;
        }

        setTimeout(function() {
          request(server)
            .post('/update')
            .send({
              access_token: token.anyfetchToken,
              api_url: process.env.ANYFETCH_SETTINGS_URL
            })
            .expect(202)
            .end(done);
        }, 50);
      });
    });

    it("should only allow array for tasks", function(done) {

      var tasks = {a:3};

      var updateAccount = function(data, cursor, next) {
        // Update the account !
        try {
          next(null, tasks, new Date());
        } catch(e) {
          e.toString().should.include('array');
          return done();
        }

        done(new Error("accepted non array tasks."));
      };

      config.updateAccount = updateAccount;

      var server = AnyFetchProvider.createServer(config);
      updateServer(server);
    });

    it("should retrieve tasks and upload them", function(done) {

      var tasks = [{a:1}, {a:2}, {a:3}];
      var counter = 1;

      var updateAccount = function(data, cursor, next) {
        // Update the account !
        next(null, tasks, new Date());
      };

      var queueWorker = function(task, anyfetchClient, data, cb) {
        // Upload document
        task.should.have.property('a').within(1, 3);
        anyfetchClient.should.have.property('sendDocument');
        data.should.have.property('foo', 'bar');

        counter += 1;
        if(counter === tasks.length) {
          done();
        }
        cb();
      };

      config.updateAccount = updateAccount;
      config.queueWorker = queueWorker;

      var server = AnyFetchProvider.createServer(config);
      updateServer(server);
    });

    it("should allow to send task in multiple batches", function(done) {
      var tasks1 = [1,2,3];
      var tasks2 = [4, 5];
      var counter = 1;

      var updateAccount = function(data, cursor, next) {
        // Send first batch
        next(null, tasks1);
        async.nextTick(function() {
          next(null, tasks2, new Date());
        });
      };

      var queueWorker = function(task, anyfetchClient, data, cb) {
        counter += 1;
        if(counter === tasks1.length + tasks2.length) {
          done();
        }
        cb();
      };

      config.updateAccount = updateAccount;
      config.queueWorker = queueWorker;

      var server = AnyFetchProvider.createServer(config);
      updateServer(server);
    });

    it("should forbid to send task after a newcursor", function(done) {
      var updateAccount = function(data, cursor, next) {
        // Send first batch with a cursor
        next(null, [1,2,3], new Date());
        // Second batch should be refused
        try {
          next(null, [4, 5], new Date());
        } catch(e) {
          return done();
        }

        throw new Error("Second batch has been accepted.");
      };

      config.updateAccount = updateAccount;

      var server = AnyFetchProvider.createServer(config);
      updateServer(server);
    });

    it("should allow to update token data", function(done) {
      var tasks = [{}];

      var updateAccount = function(data, cursor, next, updateData) {
        data.newKey = 'newValue';
        updateData(data, function(err) {
          if(err) {
            throw err;
          }

          Token.findOne({anyfetchToken: 'thetoken'}, function(err, token) {
            if(err) {
              throw err;
            }

            token.should.have.property('data');
            token.data.should.have.property('newKey', 'newValue');

            next(null, tasks, new Date());
          });
        });
      };

      var queueWorker = function(task, anyfetchClient, data, cb) {
        // Upload document
        data.should.have.property('newKey', 'newValue');

        done();
        cb();
      };

      config.updateAccount = updateAccount;
      config.queueWorker = queueWorker;

      var server = AnyFetchProvider.createServer(config);
      updateServer(server);
    });

    it("should store cursor once tasks are done", function(done) {
      var tasks = [{}, {}, {}];
      var counter = 1;

      var updateAccount = function(data, cursor, next) {
        // Update the account !
        next(null, tasks, "newcursor");
      };

      async.waterfall([
        function(cb) {
          var queueWorker = function(task, anyfetchClient, data, cb2) {
            counter += 1;
            if(counter === tasks.length) {
              async.nextTick(cb);
            }

            cb2();
          };

          config.updateAccount = updateAccount;
          config.queueWorker = queueWorker;

          var server = AnyFetchProvider.createServer(config);
          updateServer(server);
        },
        function(cb) {
          // Finish writing onto Mongo
          async.nextTick(cb);
        },
        function(cb) {
          // All tasks done
          Token.findOne({anyfetchToken: 'thetoken'}, cb);
        },
        function(token, cb) {
          token.cursor.should.equal("newcursor");
          token.isUpdating.should.equal(false);
          cb();
        }
      ], done);
    });

    it("should catch failures", function(done) {
      config.updateAccount = function(data, cursor, next) {
        // Update the account !
        next(null, [{}], new Date());
      };

      config.queueWorker = function() {
        throw new Error("I'm a failure.");
      };

      var server = AnyFetchProvider.createServer(config);

      server.queue.drain = function(err) {
        server.queue.drain = function() {};
        done(err);
      };
      updateServer(server);
    });
  });

  describe("/reset endpoint", function() {
    before(AnyFetchProvider.debug.cleanTokens);
    before(function(done) {
      // Create a token, as-if /init/ workflow was properly done
      var token = new Token({
        anyfetchToken: 'thetoken',
        data: {
          foo: 'bar'
        },
        cursor: 'current-cursor'
      });

      token.save(done);
    });


    it("should require access_token to reset", function(done) {
      var server = AnyFetchProvider.createServer(config);

      request(server)
        .del('/reset')
        .expect(409)
        .end(done);
    });

    it("should require valid access_token to reset", function(done) {
      var server = AnyFetchProvider.createServer(config);

      request(server)
        .del('/reset')
        .send({
          access_token: 'dummy_access_token'
        })
        .expect(409)
        .end(done);
    });


    it("should reset account", function(done) {
      var server = AnyFetchProvider.createServer(config);

      request(server)
        .del('/reset')
        .send({
          access_token: 'thetoken'
        })
        .expect(204)
        .end(function(err) {
          if(err) {
            throw err;
          }

          Token.findOne({anyfetchToken: 'thetoken'}, function(err, token) {
            if(err) {
              throw err;
            }

            token.should.have.property('cursor', null);

            done();
          });
        });
    });
  });


  describe("/status endpoint", function() {
    var token;
    before(AnyFetchProvider.debug.cleanTokens);
    before(function(done) {
      // Create a token, as-if /init/ workflow was properly done
      token = new Token({
        anyfetchToken: 'thetoken',
        data: {
          foo: 'bar'
        },
        cursor: 'current-cursor'
      });

      token.save(done);
    });


    it("should require an access_token", function(done) {
      var server = AnyFetchProvider.createServer(config);

      request(server)
        .get('/status')
        .expect(409)
        .end(done);
    });

    it("should require valid access_token", function(done) {
      var server = AnyFetchProvider.createServer(config);

      request(server)
        .get('/status')
        .query({
          access_token: 'dummy_access_token'
        })
        .expect(409)
        .end(done);
    });


    it("should display informations", function(done) {
      var server = AnyFetchProvider.createServer(config);

      request(server)
        .get('/status')
        .query({
          access_token: token.anyfetchToken
        })
        .expect(200)
        .expect(function(res) {
          res.body.should.have.keys(['anyfetch_token', 'data', 'cursor', 'is_updating', 'last_update']);
        })
        .end(done);
    });
  });
});
