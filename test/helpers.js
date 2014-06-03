'use strict';
require('should');

var AnyFetchProvider = require('../lib/');


describe("Helper functions", function () {
  describe("retrieveData()", function() {
    beforeEach(AnyFetchProvider.debug.cleanTokens);
    beforeEach(function(done) {
      // Create a token, as-if /init/ workflow was properly done
      AnyFetchProvider.debug.createToken({
        anyfetchToken: 'thetoken',
        data: {
          token: 'unique',
          foo: 'bar'
        }
      }, done);
    });

    it("should retrieve with code", function(done) {
      AnyFetchProvider.retrieveData({anyfetchToken: 'thetoken'}, function(err, data) {
        if(err) {
          throw err;
        }

        data.should.have.property('foo', 'bar');
        done();
      });
    });

    it("should retrieve with data", function(done) {
      AnyFetchProvider.retrieveData({'data.token': 'unique'}, function(err, data) {
        if(err) {
          throw err;
        }

        data.should.have.property('foo', 'bar');
        done();
      });
    });

    it("should fail for non existing tokens", function(done) {
      AnyFetchProvider.retrieveData({'data.token': 'notthisone'}, function(err) {
        if(!err) {
          throw new Error("retrieveData() with invalid value should throw an error");
        }
        done();
      });
    });
  });
});
