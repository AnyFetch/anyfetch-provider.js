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

module.exports.logError = function logError(err, req, extra) {
  // No logging on test or if err is undefined
  if(process.env.NODE_ENV === "test" || !err) {
    return;
  }

  if(!extra) {
    extra = req;
    req = null;
  }

  delete err.domain;
  delete err.domainThrown;

  if(err.__alreadyLogged) {
    console.warn("Skipping an error already sent to Opbeat: ", err.toString());
    return;
  }

  if(!extra) {
    extra = {};
  }

  if(module.exports.logError.config) {
    extra.provider = module.exports.logError.config.providerUrl;
  }

  if(module.exports.logError.opbeat) {
    var meta = {
      extra: extra
    };

    if(req) {
      meta.request = req;

      if(req.token) {
        meta.user = {
          is_authenticated: true,
          id: req.token.anyfetchToken,
          username: req.token.accountName,
          email: req.token.accountName
        };
      }
    }

    module.exports.logError.opbeat.captureError(err, meta);
  }
  else {
    var all = {
      details: err.toString(),
      err: err,
      extra: extra
    };

    try {
      all = JSON.stringify(all);
    }
    catch(e) {
      // Converting circular structure to JSON.
      // We can't do anything, let's log the raw object.
    }

    console.warn("LOG-ERROR-DETAILS", all);
  }

  err.__alreadyLogged = true;
};
