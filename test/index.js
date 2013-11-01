'use strict';

require('should');
var request = require('supertest');
var async = require('async');
var Cluestr = require('cluestr');

var CluestrProvider = require('../lib/cluestr-provider');
var TempToken = require('../lib/cluestr-provider/models/temp-token.js');
var Token = require('../lib/cluestr-provider/models/token.js');

var accessGrant = "fakeAccessGrant";


var initAccount = function(req, next) {
  var preDatas = {
    accessGrant: accessGrant
  };
  next(null, preDatas, 'http://localhost');
};

var connectAccountRetrievePreDatasIdentifier = function(req, next) {
  // Retrieve temp token
  next(null, {'datas.accessGrant': accessGrant});
};

var connectAccountRetrieveAuthDatas = function(req, preDatas, next) {
  var datas = preDatas.accessGrant + "_accessToken";
  next(null, datas);
};

var updateAccount = function(datas, cursor, next) {
  // Update the account !
  next([], new Date());
};

var queueWorker = function(task, cluestrClient, datas, cb) {
  // Upload document
  cb();
};

var config = {};
var resetConfig = function() {
  // Reset config to pristine state
  config = {
    initAccount: initAccount,
    connectAccountRetrievePreDatasIdentifier: connectAccountRetrievePreDatasIdentifier,
    connectAccountRetrieveAuthDatas: connectAccountRetrieveAuthDatas,
    updateAccount: updateAccount,
    queueWorker: queueWorker,

    cluestrAppId: 'appId',
    cluestrAppSecret: 'appSecret',
    connectUrl: 'http://localhost:1337/init/connect'
  };
};


describe("CluestrProvider.createServer() config", function() {
  beforeEach(resetConfig);

  it("should validate correct config", function(done) {
    var ret = CluestrProvider.validateConfig(config);

    if(ret) {
      throw new Error("No error should be returned");
    }

    done();
  });

  it("should err on missing handler", function(done) {
    delete config.initAccount;
    CluestrProvider.validateConfig(config).toString().should.include('Specify `initAccount');
    done();
  });

  it("should err on missing parameter", function(done) {
    delete config.cluestrAppId;
    CluestrProvider.validateConfig(config).toString().should.include('Specify `cluestrAppId');
    done();
  });
});


describe("CluestrProvider.createServer()", function() {
  beforeEach(resetConfig);

  describe("/init endpoints", function() {
    beforeEach(CluestrProvider.debug.cleanTokens);

    it("should require cluestr code", function(done) {
      var server = CluestrProvider.createServer(config);

      request(server).get('/init/connect')
        .expect(409)
        .end(done);
    });

    it("should store datas returned by initAccount() in TempToken", function(done) {
      var initAccount = function(req, next) {
        var preDatas = {
          "foo": "bar"
        };

        next(null, preDatas, 'http://localhost');
      };

      config.initAccount = initAccount;

      var server = CluestrProvider.createServer(config);

      request(server).get('/init/connect?code=cluestr_code')
        .expect(302)
        .end(function(err) {
          if(err) {
            throw err;
          }

          TempToken.findOne({'datas.foo': 'bar'}, function(err, tempToken) {
            if(err) {
              return done(err);
            }

            tempToken.should.have.property('cluestrCode', 'cluestr_code');

            done();
          });

        });
    });

    it("should retrieve datas on TempToken", function(done) {
      // Fake Cluestr server handling access token scheme
      process.env.CLUESTR_FRONT = 'http://localhost:1337';

      // Create a fake HTTP server
      var frontServer = Cluestr.debug.createTestFrontServer();
      frontServer.listen(1337);

      var originalPreDatas = {
        'key': 'retrieval',
        'something': 'data'
      };

      async.series([
        function(cb) {
          // Fake a call to /init/connect returned this datas
          var tempToken = new TempToken({
            cluestrCode: 'cluestr_token',
            datas: originalPreDatas
          });

          tempToken.save(cb);
        },
        function(cb) {
          var connectAccountRetrievePreDatasIdentifier = function(req, next) {
            // Retrieve temp token
            next(null, {'datas.key': req.params.code});
          };

          var connectAccountRetrieveAuthDatas = function(req, preDatas, next) {
            preDatas.should.eql(originalPreDatas);
            next(null, {
              'final': 'my-code'
            });
          };

          config.connectAccountRetrievePreDatasIdentifier = connectAccountRetrievePreDatasIdentifier;
          config.connectAccountRetrieveAuthDatas = connectAccountRetrieveAuthDatas;

          var server = CluestrProvider.createServer(config);

          request(server).get('/init/callback?code=retrieval')
            .expect(302)
            .end(function(err) {
            if(err) {
              throw err;
            }

            Token.findOne({'datas.final': 'my-code'}, function(err, token) {
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
          access_token: 'thetoken'
        })
        .expect(202)
        .end(done);
    };

    beforeEach(CluestrProvider.debug.cleanTokens);
    beforeEach(function(done) {
      // Create a token, as-if /init/ workflow was properly done
      var token = new Token({
        cluestrToken: 'thetoken',
        datas: {
          foo: 'bar'
        }
      });

      token.save(done);
    });


    it("should require access_token to update", function(done) {
      var server = CluestrProvider.createServer(config);

      request(server)
        .post('/update')
        .expect(409)
        .end(done);
    });


    it("should require valid access_token to update", function(done) {
      var server = CluestrProvider.createServer(config);

      request(server)
        .post('/update')
        .send({
          access_token: 'dummy_access_token'
        })
        .expect(409)
        .end(done);
    });


    it("should disable updating while updating", function(done) {
      var server = CluestrProvider.createServer(config);

      updateServer(server, function(err) {
        if(err) {
          throw err;
        }

        request(server)
          .post('/update')
          .send({
            access_token: 'thetoken'
          })
          .expect(204)
          .end(done);
      });
    });

    it("should only allow array for tasks", function(done) {

      var tasks = {a:3};

      var updateAccount = function(datas, cursor, next) {
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

      var server = CluestrProvider.createServer(config);
      updateServer(server);
    });

    it("should retrieve tasks and upload them", function(done) {

      var tasks = [{a:1}, {a:2}, {a:3}];
      var counter = 1;

      var updateAccount = function(datas, cursor, next) {
        // Update the account !
        next(null, tasks, new Date());
      };

      var queueWorker = function(task, cluestrClient, datas, cb) {
        // Upload document
        task.should.have.property('a').within(1, 3);
        cluestrClient.should.have.property('sendDocument');
        datas.should.have.property('foo', 'bar');

        counter += 1;
        if(counter === tasks.length) {
          done();
        }
        cb();
      };

      config.updateAccount = updateAccount;
      config.queueWorker = queueWorker;

      var server = CluestrProvider.createServer(config);
      updateServer(server);
    });

    it("should allow to send task in multiple batches", function(done) {
      var tasks1 = [1,2,3];
      var tasks2 = [4, 5];
      var counter = 1;

      var updateAccount = function(datas, cursor, next) {
        // Send first batch
        next(null, tasks1);
        async.nextTick(function() {
          next(null, tasks2, new Date());
        });
      };

      var queueWorker = function(task, cluestrClient, datas, cb) {
        counter += 1;
        if(counter === tasks1.length + tasks2.length) {
          done();
        }
        cb();
      };

      config.updateAccount = updateAccount;
      config.queueWorker = queueWorker;

      var server = CluestrProvider.createServer(config);
      updateServer(server);
    });

    it("should forbid to send task after a newcursor", function(done) {
      var updateAccount = function(datas, cursor, next) {
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

      var server = CluestrProvider.createServer(config);
      updateServer(server);
    });

    it("should allow to update token datas", function(done) {
      var tasks = [{}];

      var updateAccount = function(datas, cursor, next, updateDatas) {
        datas.newKey = 'newValue';
        updateDatas(datas, function(err) {
          if(err) {
            throw err;
          }

          Token.findOne({cluestrToken: 'thetoken'}, function(err, token) {
            if(err) {
              throw err;
            }

            token.should.have.property('datas');
            token.datas.should.have.property('newKey', 'newValue');

            next(null, tasks, new Date());
          });
        });
      };

      var queueWorker = function(task, cluestrClient, datas, cb) {
        // Upload document
        datas.should.have.property('newKey', 'newValue');

        done();
        cb();
      };

      config.updateAccount = updateAccount;
      config.queueWorker = queueWorker;

      var server = CluestrProvider.createServer(config);
      updateServer(server);
    });

    it("should store cursor once tasks are done", function(done) {
      var tasks = [{}, {}, {}];
      var counter = 1;

      var updateAccount = function(datas, cursor, next) {
        // Update the account !
        next(null, tasks, "newcursor");
      };

      async.waterfall([
        function(cb) {
          var queueWorker = function(task, cluestrClient, datas, cb2) {
            counter += 1;
            if(counter === tasks.length) {
              async.nextTick(cb);
            }

            cb2();
          };

          config.updateAccount = updateAccount;
          config.queueWorker = queueWorker;

          var server = CluestrProvider.createServer(config);
          updateServer(server);
        },
        function(cb) {
          // Finish writing onto Mongo
          async.nextTick(cb);
        },
        function(cb) {
          // All tasks done
          Token.findOne({cluestrToken: 'thetoken'}, cb);
        },
        function(token, cb) {
          token.cursor.should.equal("newcursor");
          token.isUpdating.should.equal(false);
          cb();
        }
      ], done);
    });
  });

  describe("/reset endpoint", function() {
    before(CluestrProvider.debug.cleanTokens);
    before(function(done) {
      // Create a token, as-if /init/ workflow was properly done
      var token = new Token({
        cluestrToken: 'thetoken',
        datas: {
          foo: 'bar'
        },
        cursor: 'current-cursor'
      });

      token.save(done);
    });


    it("should require access_token to reset", function(done) {
      var server = CluestrProvider.createServer(config);

      request(server)
        .post('/reset')
        .expect(409)
        .end(done);
    });

    it("should require valid access_token to reset", function(done) {
      var server = CluestrProvider.createServer(config);

      request(server)
        .post('/reset')
        .send({
          access_token: 'dummy_access_token'
        })
        .expect(409)
        .end(done);
    });


    it("should reset account", function(done) {
      var server = CluestrProvider.createServer(config);

      request(server)
        .post('/reset')
        .send({
          access_token: 'thetoken'
        })
        .expect(204)
        .end(function(err) {
          if(err) {
            throw err;
          }

          Token.findOne({cluestrToken: 'thetoken'}, function(err, token) {
            if(err) {
              throw err;
            }

            token.should.have.property('cursor', null);

            done();
          });
        });
    });
  });
});


describe("Helper functions", function () {
  beforeEach(CluestrProvider.debug.cleanTokens);
  it("should give access to retrieveDatas()", function(done) {
    async.series([
      function(cb) {
        // Create a token, as-if /init/ workflow was properly done
        var token = new Token({
          cluestrToken: 'thetoken',
          datas: {
            token: 'unique',
            foo: 'bar'
          }
        });

        token.save(cb);
      },
      function(cb) {
        CluestrProvider.retrieveDatas({cluestrToken: 'thetoken'}, function(err, datas) {
          if(err) {
            throw err;
          }

          datas.should.have.property('foo', 'bar');
          cb();
        });
      },
      function(cb) {
        CluestrProvider.retrieveDatas({'datas.token': 'unique'}, function(err, datas) {
          if(err) {
            throw err;
          }

          datas.should.have.property('foo', 'bar');

          cb();
        });
      }
    ], done);
  });
});
