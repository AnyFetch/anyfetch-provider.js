'use strict';
/**
 * @file Model for Token
 *
 * Every connected user from AnyFetch has one, mapping its AnyFetch token to a set of Dropbox tokens.
 */
var mongoose = require('mongoose');

var TokenSchema = new mongoose.Schema({
  // Access token to communicate with AnyFetch
  anyfetchToken: {type: String, default: '', unique: true},

  // Account identifier
  accountName: '',

  // Data needed by the provider
  data: {},

  // Last cursor (may be a date, a string or anything)
  cursor: {},

  // Are we currently updating
  isUpdating: {type:Boolean, default: false},

  // Date we started last update
  lastUpdate: {type: Date, default: null}
});

// Register & export the model
module.exports = mongoose.model('Token', TokenSchema);
