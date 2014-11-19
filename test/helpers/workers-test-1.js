'use strict';

require('should');

module.exports.test = function testWorker(job, cb) {
  try {
    job.task.should.have.property('a').within(1, 3);
    job.serviceData.should.have.property('foo', 'bar');
  }
  catch(e) {
    return cb(e);
  }

  cb();
};
