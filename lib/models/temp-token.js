'use strict';
/**
 * @file Model for a temporary token
 *
 * Temporary tokens holds data about request tokens and temporary AnyFetch code, while waiting for the user to consent on dropbox site.
 */
var mongoose = require('mongoose');

var TempTokenSchema = new mongoose.Schema({
  // Authorization code to communicate with AnyFetch
  anyfetchCode: '',

  // URL to redirect client
  returnTo: '',

  // Can be anything
  data: {},

  // TempToken expires after 10 mins
  createdAt: {type: Date, default: Date.now, index : { expires : 600 }}
});

// Register & export the model
module.exports = mongoose.model('TempToken', TempTokenSchema);
