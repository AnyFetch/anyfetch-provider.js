'use strict';
/**
 * @file Model for a temporary token
 *
 * Temporary tokens holds datas about request tokens and temporary AnyFetch code, while waiting for the user to consent on dropbox site.
 */
var mongoose = require('mongoose');

var TempTokenSchema = new mongoose.Schema({
  // Authorization code to communicate with AnyFetch
  anyFetchCode: '',

  // Can be anything
  datas: {},

});

// Register & export the model
module.exports = mongoose.model('TempToken', TempTokenSchema);
