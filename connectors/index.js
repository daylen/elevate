var async = require('async');
var logger = require('../logger');

module.exports.fitbit = require('./impl/fitbit');
module.exports.jawbone = require('./impl/jawbone');
module.exports.strava = require('./impl/strava');

module.exports.crawlNow = function(callback) {
	logger.info('Crawling now');
	var functions = [module.exports.fitbit.crawl,
					 module.exports.jawbone.crawl,
					 module.exports.strava.crawl];
	async.parallel(functions, callback);
};

module.exports.enableBackgroundCrawl = function() {
	logger.info('Enabled background crawl');
	setInterval(function() {
		module.exports.crawlNow(function(err) {
			if (err) logger.error(err);
		});
	}, 1000 * 60 * 2); // every two minutes
};