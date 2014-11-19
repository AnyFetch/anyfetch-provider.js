'use strict';

var tasks = [{a: 1, identifier: 'a'}, {a: 2, identifier: 'b'}, {a: 3, identifier: 'c'}];

module.exports = function updateAccount(serviceData, cursor, queues, cb) {
  // Update the account !
  tasks.forEach(function(task) {
    queues.test.push(task);
  });

  cb(null, new Date(), {foo: 'bar', newKey: 'newValue'});
};
