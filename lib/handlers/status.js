'use strict';

var async = require('async');

/**
 * This handler display (anonymous) information about the provider
 *
 * @param {Object} req Request object from the client
 * @param {Object} res Response we want to return
 * @param {Function} next Callback to call once res has been populated.
 */
module.exports.get = function statusGet(req, res, next) {
  var server = require('../index.js').currentServer;

  async.waterfall([
    function getStats(cb) {
      server.yaqsClient.stats(cb);
    },
    function sendData(stats, cb) {
      if(!stats['anyfetch-provider-users']) {
        // Fake values when not available
        stats['anyfetch-provider-users'] = {
          pending: 0,
          processing: 0
        };
      }

      var data = {
        users: {
          pending: stats['anyfetch-provider-users'].pending,
          processing: stats['anyfetch-provider-users'].processing
        },
        pending_queues: [],
        pending_documents: 0
      };

      Object.keys(stats).forEach(function(name) {
        if(name === 'anyfetch-provider-users') {
          return;
        }

        data.pending_queues.push({
          pending: stats[name].pending,
          processing: stats[name].processing
        });

        data.pending_documents += stats[name].pending;
      });

      res.send(data);
      cb();
    }
  ], next);
};
