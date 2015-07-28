var querystring = require('querystring');
var Token = require('../../model/token');
var Strava = require('../../model/strava');
var request = require('request');
var async = require('async');
var shared = require('../shared');

// Public

module.exports.getAuthUrl = function(redirectFragment) {
	var base = "https://www.strava.com/oauth/authorize?";
	var params = {
		'client_id': globalConfig.strava.client_id,
		'redirect_uri': globalConfig.oauth_redirect_base + redirectFragment,
		'response_type': 'code',
		'scope': 'view_private'
	};
	return base + querystring.stringify(params);
}

module.exports.doTokenExchange = function(authCode, callback) {
	var url = 'https://www.strava.com/oauth/token';
	var params = {
		'client_id': globalConfig.strava.client_id,
		'client_secret': globalConfig.strava.client_secret,
		'code': authCode
	};
	shared.doTokenExchange(url, params, {}, 'strava', callback);
}

module.exports.crawl = function(callback) {
	Token.findOne({service: 'strava'}, function(err, token) {
		if (err) return callback(err);
		if (!token) return callback(new Error('Service is not connected'));
		_crawlStravaActivities(token.accessToken, 1, callback);
	});
}

// Private

function _log(str) {
	console.log('[Strava] ' + str);
}

function _crawlStravaActivities(accessToken, pageNum, callback) {
	_log('Crawling Strava page ' + pageNum);
	var base = "https://www.strava.com/api/v3/athlete/activities?";
	var params = {
		access_token: accessToken,
		page: pageNum
	};
	request.get({url: base, qs: params}, function(err, response, body) {
		if (err) return callback(err);
		var activities = JSON.parse(body);
		_log('Got ' + activities.length + ' activities');
		var shouldCrawlNextPage = false;

		async.each(activities, function(activity, callback) {
			Strava.findOneAndUpdate({id: activity.id}, activity,
				{'new': false, upsert: true}, function(err, doc) {
					if (err) return callback(err);
					if (!doc) {
						_log('Adding new activity!');
						shouldCrawlNextPage = true;
					}
					callback();
				});
		}, function(err) {
			if (err) return callback(err);
			if (shouldCrawlNextPage) {
				// Recursion, because why not
				_crawlStravaActivities(accessToken, pageNum + 1, callback);
			} else {
				_log('Finished crawling');
				callback();
			}
		});
	});
}
