var querystring = require('querystring');
var Token = require('../../model/token');
var Fitbit = require('../../model/fitbit');
var request = require('request');
var shared = require('../shared');
var async = require('async');
var _ = require('underscore');

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
		_verifyAccessToken(token, function(err) {
			_log('Finished crawling');
			callback(err);
		});
	});
};

// Private

function _log(str) {
	console.log('[Fitbit] ' + str);
}

function _getClientAuthHeader() {
	var str = new Buffer(globalConfig.fitbit.client_id + ':' +
		globalConfig.fitbit.client_secret).toString('base64');
	return {'Authorization': 'Basic ' + str};
}

function _refreshAccessToken(refreshToken, callback) {
	_log('Refreshing access token');
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
	_log('Verifying token');
	var authHeader = {'Authorization': 'Bearer ' + token.accessToken};
	request.get({url: "https://api.fitbit.com/1/user/-/devices.json", headers: authHeader},
		function(err, response, body) {
			if (err) return callback(err);
			if (response.statusCode == 401)
				return _refreshAccessToken(token.refreshToken, function(err) {
					if (err) return callback(err);
					module.exports.crawl(callback);
				});
			if (response.statusCode == 429)
				return callback(new Error('Reached rate limit'));
			_log('Verified');
			_fetchFitbitData(token.accessToken, callback);
		});
}

function _fetchFitbitData(accessToken, callback) {
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
	var authHeader = {'Authorization': 'Bearer ' + accessToken};
	var data = [];
	async.each(urls, function(url, callback) {
		request.get({url: url, headers: authHeader},
			function(err, response, body) {
				if (err) return callback(err);
				var json = JSON.parse(body);
				if (json.errors) {
					return callback(new Error(JSON.stringify(json.errors)));
				}
				data.push(json);
				callback();
			});
	}, function(err) {
		if (err) return callback(err);
		var transformed = _transformFitbitData(data);
		_storeTransformedData(transformed, callback);
	});
}

/*
Input:
[{calories: [{date: 2015-01-01, value: 2000}, ...]},
 {steps: [{date: 2015-01-01, value: 10000}, ...]},
 ...]

Output:
[{date: 2015-01-01, calories: 2000, steps: 10000, ...},
 {date: 2015-01-02, calories: 2000, steps: 10000, ...},
 ...]
*/
function _transformFitbitData(data) {
	var dataObj = data.reduce(function(acc, x) {
		for (var key in x) acc[key] = x[key];
		return acc;
	}, {});
	var justDatapoints = [];
	for (var measurementName in dataObj) {
		for (var datapoint of dataObj[measurementName]) {
			datapoint[measurementName.substring(measurementName.indexOf('-') + 1)] = datapoint.value;
			datapoint.dateTime = new Date(datapoint.dateTime);
			delete datapoint.value;
		}
		justDatapoints.push(dataObj[measurementName]);
	}
	var groupedObj = _.groupBy(_.flatten(justDatapoints), 'dateTime');
	var reducedObj = _.mapObject(groupedObj, function(val, key) {
		return val.reduce(function(acc, x) {
			for (var key in x) acc[key] = x[key];
			return acc;
		}, {});
	});
	return _.filter(_.values(reducedObj), function(x) { return x.steps > 0; });
}

function _storeTransformedData(arr, callback) {
	async.each(arr, function(summary, callback) {
		Fitbit.findOneAndUpdate({dateTime: summary.dateTime}, summary,
			{upsert: true}, callback);
	}, callback);
}
