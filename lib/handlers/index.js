'use strict';

module.exports.get = function indexGet(req, res, next) {
  res.header('Location', 'http://anyfetch.com');
  res.send(302);

  next();
};
