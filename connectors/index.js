var async = require('async');

module.exports.fitbit = require('./impl/fitbit');
module.exports.jawbone = require('./impl/jawbone');
module.exports.strava = require('./impl/strava');

module.exports.crawlNow = function(callback) {
	console.log('Crawling now');
	var functions = [module.exports.fitbit.crawl, module.exports.strava.crawl];
	async.parallel(functions, callback);
}

module.exports.enableBackgroundCrawl = function() {
	console.log('Enabled background crawl');
	setInterval(function() {
		module.exports.crawlNow(function(err) {
			if (err) console.log(err);
		});
	}, 1000 * 60 * 5); // 5 minutes
}