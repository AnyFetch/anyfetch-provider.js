'use strict';


/**
 * This handler display information about the token
 *
 * @param {Object} req Request object from the client
 * @param {Object} res Response we want to return
 * @param {Function} next Callback to call once res has been populated.
 */
module.exports.get = function statusGet(req, res, next) {
  res.send({
    anyfetch_token: req.token.anyfetchToken,
    data: req.token.data,
    accountName: req.token.accountName,
    cursor: req.token.cursor,
    is_updating: req.token.isUpdating,
    last_update: req.token.lastUpdate,
  });

  next();
};
