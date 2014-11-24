'use strict';

var Childs = require('../lib/Childs.js');

describe('Childs', function() {
  it('should restart childs', function(done) {
    var childs = new Childs(1, __dirname + '/failed-child-process.js', {errored: true});

    childs.once('stop', function() {
      done();
    });

    childs.start();
    childs.childs[0].data = {errored: false};
  });
});
