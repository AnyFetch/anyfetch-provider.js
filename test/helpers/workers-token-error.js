'use strict';

require('should');

var TokenError = require('../../lib/errors/token');

module.exports.test = function testWorker(job, cb) {
  cb(new TokenError());
};
