'use strict';

module.exports = function(req, res, next) {
  res.header('Location', 'http://anyfetch.com');
  res.send(302);

  next();
};
