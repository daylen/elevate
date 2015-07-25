var querystring = require('querystring');
var Token = require('../model/token');
var Strava = require('../model/strava');
var request = require('request');
var async = require('async');

module.exports.authRequestUrl = function(redirect_fragment) {
	var base = "https://www.strava.com/oauth/authorize?";
	var params = {
		'client_id': globalConfig.strava.client_id,
		'redirect_uri': globalConfig.oauth_redirect_base + redirect_fragment,
		'response_type': 'code',
		'scope': 'view_private'
	};
	return base + querystring.stringify(params);
}

function crawlStravaActivities(access_token, page_num) {
	console.log('Crawling Strava page ' + page_num);
	var base = "https://www.strava.com/api/v3/athlete/activities?";
	var params = {
		access_token: access_token,
		page: page_num
	};
	request.get({url: base, qs: params}, function(err, response, body) {
		if (err) throw err;
		var activities = JSON.parse(body);
		console.log('Got ' + activities.length + ' activities');
		var shouldCrawlNextPage = false;

		async.each(activities, function(activity, callback) {
			Strava.findOneAndUpdate({id: activity.id}, activity,
				{'new': false, upsert: true}, function(err, doc) {
					if (err) return callback(err);
					if (!doc) {
						console.log('Adding new activity!');
						shouldCrawlNextPage = true;
					}
					callback();
				});
		}, function(err) {
			if (err) throw err;
			console.log('Done with this page');
			console.log('Should crawl next page: ' + shouldCrawlNextPage);
			if (shouldCrawlNextPage) {
				// Recursion, because why not
				crawlStravaActivities(access_token, page_num + 1);
			}
		});
	});
}

module.exports.crawl = function() {
	Token.findOne({service: 'strava'}, function(err, token) {
		if (err) throw err;
		crawlStravaActivities(token.accessToken, 1);
	});
}