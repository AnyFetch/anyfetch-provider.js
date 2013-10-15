'use strict';
/**
 * @file Model for Token
 *
 * Every connected user from Cluestr has one, mapping its Cluestr token to a set of Dropbox tokens.
 */
var mongoose = require('mongoose');

var TokenSchema = new mongoose.Schema({
  // Access token to communicate with Cluestr
  cluestrToken: '',

  // Datas needed by the provider
  datas: {},

  // Last cursor (may be a date, a string or anything)
  cursor: {}
});

// Register & export the model
module.exports = mongoose.model('Token', TokenSchema);
