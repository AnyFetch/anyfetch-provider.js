'use strict';

var util = require('util');

var CancelError = function() {
  this.name = 'CancelError';
  this.message = "User cancelled the authorization";
};
util.inherits(CancelError, Error);

module.exports = CancelError;
