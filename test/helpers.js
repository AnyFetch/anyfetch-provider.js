'use strict';
require('should');

var CluestrProvider = require('../lib/cluestr-provider');
var Token = require('../lib/cluestr-provider/models/token.js');


describe("Helper functions", function () {
  describe("retrieveDatas()", function() {
    beforeEach(CluestrProvider.debug.cleanTokens);
    beforeEach(function(done) {
      // Create a token, as-if /init/ workflow was properly done
      var token = new Token({
        cluestrToken: 'thetoken',
        datas: {
          token: 'unique',
          foo: 'bar'
        }
      });

      token.save(done);
    });

    it("should retrieve with code", function(done) {
      CluestrProvider.retrieveDatas({cluestrToken: 'thetoken'}, function(err, datas) {
        if(err) {
          throw err;
        }

        datas.should.have.property('foo', 'bar');
        done();
      });
    });

    it("should retrieve with datas", function(done) {
      CluestrProvider.retrieveDatas({'datas.token': 'unique'}, function(err, datas) {
        if(err) {
          throw err;
        }

        datas.should.have.property('foo', 'bar');
        done();
      });
    });

    it("should fail for non existing tokens", function(done) {
      CluestrProvider.retrieveDatas({'datas.token': 'notthisone'}, function(err) {
        if(!err) {
          throw new Error("retrieveDatas() with invalid value should throw an error");
        }
        done();
      });
    });
  });
});
