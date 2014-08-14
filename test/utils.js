'use strict';

require('should');

var generateTitle = require('../lib/util.js').generateTitle;

describe('Utils functions', function() {
  describe('generateTitle()', function() {
    it('should return valid title', function(done) {
      var document = 'this-is-a-file.doc';
      generateTitle(document).should.be.eql('This is a file');
      done();
    });

    it('should return undefined is there is no file name', function(done) {
      if(generateTitle() === undefined) {
        return done();
      }
      throw new Error('should not throw error');
    });

    it('should not return the path', function(done) {
      var document = '/path/to/a/doc/this-is-a-file.doc';
      generateTitle(document).should.be.eql('This is a file');
      done();
    });
  });
});
