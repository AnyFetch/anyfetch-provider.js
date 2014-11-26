'use strict';

var Childs = require('../lib/Childs.js');

describe('Childs', function() {
  it('should restart childs', function(done) {
    var childs = new Childs(1, __dirname + '/child-process.js', {error: true});

    childs.once('stop', function(forced) {
      forced.should.eql(false);
      done();
    });

    childs.start();
    childs.childs[0].data = {error: false, processing: false};
  });

  it('should kill all childs', function(done) {
    var childs = new Childs(1, __dirname + '/child-process.js', {error: false, processing: true});

    childs.once('stop', function(forced) {
      forced.should.eql(true);
      done();
    });

    childs.kill(function(err) {
      if(err) {
        done(err);
      }
    });
  });
});
