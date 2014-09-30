'use strict';

var path = require('path');
var url = require('url');

module.exports.generateTitle = function generateTitle(filepath) {
  if(!filepath) {
    return undefined;
  }

  var title = path.basename(filepath, path.extname(filepath));

  title = title.replace(/(_|-|\.)/g, ' ');
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return title;
};

module.exports.redirectToReturnTo = function redirectToReturnTo(res, returnTo, params) {
  if(!params) {
    params = {};
  }

  var urlObj = url.parse(returnTo, true);
  delete urlObj.search;

  Object.keys(params).forEach(function(name) {
    urlObj.query[name] = params[name];
  });
  
  res.send(302, null, {
    location: url.format(urlObj)
  });
};