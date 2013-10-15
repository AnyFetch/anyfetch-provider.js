'use strict';
var mochaMongoose = require('mocha-mongoose');

var clearMongo = mochaMongoose(process.env.MONGO_URL || "mongodb://localhost/cluestr-provider", {noClear: true});


module.exports.cleaner = function(done) {
	clearMongo(done);
};
