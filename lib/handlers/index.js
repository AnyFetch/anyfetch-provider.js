'use strict';


/**
 * Simple redirection to anyfetch.com, useful to check a server is deployed.
 */
module.exports.get = function indexGet(req, res, next) {
  res.header('Location', 'http://anyfetch.com');
  res.send(302);

  next();
};
