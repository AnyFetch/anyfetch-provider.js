'use strict';

var util = require('util');

var TokenError = function() {
  this.name = 'TokenError';
  this.message = "Token need to be refresh";
};
util.inherits(TokenError, Error);

module.exports = TokenError;
