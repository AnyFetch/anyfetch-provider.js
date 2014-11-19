'use strict';

require('should');

module.exports.test = function testWorker(job, cb) {
  try {
    job.serviceData.should.have.property('newKey', 'newValue');
  }
  catch(e) {
    return cb(e);
  }

  cb();
};
