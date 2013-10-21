'use strict';

var CluestrProvider = require('../lib/cluestr-provider');

module.exports = function(done) {
	CluestrProvider.debug.cleanTokens(done);
};
