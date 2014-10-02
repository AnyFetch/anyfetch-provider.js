'use strict';

var logger = require('restify-logger');

var filter = function filter(req, res) {
  return process.env.NODE_ENV !== "test" && req.method !== "OPTIONS";
};

var display = function display(req, res) {
  return (req.token && req.token.accountName) ? req.token.accountName : '???';
};

module.exports = logger(filter, display);
