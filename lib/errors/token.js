'use strict';

var util = require('util');

var TokenError = function() {
  this.name = 'TokenError';
  this.message = "Token is not valid anymore";
};
util.inherits(TokenError, Error);

module.exports = TokenError;
