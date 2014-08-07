'use strict';

var path = require('path');

module.exports.generateTitle = function generateTitle(filepath) {
  var title = path.basename(filepath, path.extname(filepath));

  title = title.replace(/(_|-|\.)/g, ' ');
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return title;
};