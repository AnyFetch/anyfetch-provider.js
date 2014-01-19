'use strict';
require('should');

var AnyFetchProvider = require('../lib/');


describe("Helper functions", function () {
  describe("retrieveDatas()", function() {
    beforeEach(AnyFetchProvider.debug.cleanTokens);
    beforeEach(function(done) {
      // Create a token, as-if /init/ workflow was properly done
      AnyFetchProvider.debug.createToken({
        anyFetchToken: 'thetoken',
        datas: {
          token: 'unique',
          foo: 'bar'
        }
      }, done);
    });

    it("should retrieve with code", function(done) {
      AnyFetchProvider.retrieveDatas({anyFetchToken: 'thetoken'}, function(err, datas) {
        if(err) {
          throw err;
        }

        datas.should.have.property('foo', 'bar');
        done();
      });
    });

    it("should retrieve with datas", function(done) {
      AnyFetchProvider.retrieveDatas({'datas.token': 'unique'}, function(err, datas) {
        if(err) {
          throw err;
        }

        datas.should.have.property('foo', 'bar');
        done();
      });
    });

    it("should fail for non existing tokens", function(done) {
      AnyFetchProvider.retrieveDatas({'datas.token': 'notthisone'}, function(err) {
        if(!err) {
          throw new Error("retrieveDatas() with invalid value should throw an error");
        }
        done();
      });
    });
  });
});
