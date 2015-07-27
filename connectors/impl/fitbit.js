var querystring = require('querystring');
var Token = require('../../model/token');
var Fitbit = require('../../model/fitbit');
var request = require('request');
var shared = require('../shared');
var async = require('async');

// Public

module.exports.getAuthUrl = function(redirectFragment) {
	var base = "https://www.fitbit.com/oauth2/authorize?";
	var params = {
		'client_id': globalConfig.fitbit.client_id,
		'response_type': 'code',
		'scope': 'activity heartrate location nutrition profile settings sleep social weight',
		'redirect_uri': globalConfig.oauth_redirect_base + redirectFragment
	};
	return base + querystring.stringify(params);
};

module.exports.doTokenExchange = function(authCode, callback) {
	var url = 'https://api.fitbit.com/oauth2/token';
	var params = {
		'client_id': globalConfig.fitbit.client_id,
		'grant_type': 'authorization_code',
		'code': authCode,
		'redirect_uri': globalConfig.oauth_redirect_base + '/admin/fitbit'
	};
	shared.doTokenExchange(url, params, _getClientAuthHeader(), 'fitbit', callback);
};

module.exports.crawl = function(callback) {
	Token.findOne({service: 'fitbit'}, function(err, token) {
		if (err) return callback(err);
		if (!token) return callback(new Error('Service is not connected'));
		_verifyAccessToken(token, callback);
	});
};

// Private

function _getClientAuthHeader() {
	var str = new Buffer(globalConfig.fitbit.client_id + ':' +
		globalConfig.fitbit.client_secret).toString('base64');
	return {'Authorization': 'Basic ' + str};
}

function _refreshAccessToken(refreshToken, callback) {
	console.log('Refreshing access token');
	var url = "https://api.fitbit.com/oauth2/token";
	var params = {
		grant_type: 'refresh_token',
		refresh_token: refreshToken
	};
	var authHeader = new Buffer(globalConfig.fitbit.client_id + ':' +
		globalConfig.fitbit.client_secret).toString('base64');
	shared.doTokenExchange(url, params, _getClientAuthHeader(), 'fitbit', callback);
}

function _verifyAccessToken(token, callback) {
	console.log('Verifying token');
	var authHeader = {'Authorization': 'Bearer ' + token.accessToken};
	request.get({url: "https://api.fitbit.com/1/user/-/devices.json", headers: authHeader},
		function(err, response, body) {
			if (err) return callback(err);
			if (response.statusCode == 401)
				return _refreshAccessToken(token.refreshToken, function(err) {
					if (err) return callback(err);
					module.exports.crawl(callback);
				});
			console.log('Verified');
			_crawlFitbitData(token.accessToken, callback);
		});
}

function _crawlFitbitData(accessToken, callback) {
	var fragments = [
		'calories',
		'caloriesBMR',
		'steps',
		'distance',
		'floors',
		'elevation',
		'heart',
		'minutesSedentary',
		'minutesLightlyActive',
		'minutesFairlyActive',
		'minutesVeryActive',
		'activityCalories'
	];
	var urls = fragments.map( s => "https://api.fitbit.com/1/user/-/activities/" + s + "/date/today/1y.json");
	console.log(urls);
	var authHeader = {'Authorization': 'Bearer ' + accessToken};
	async.each(urls, function(url, callback) {
		request.get({url: url, headers: authHeader},
			function(err, response, body) {
				if (err) return callback(err);
				var json = JSON.parse(body);
				console.log(json);
				callback();
				// TODO store this data
			});
	}, function(err) {
		if (err) return callback(err);
		console.log('Done');
		callback();
	});
}
