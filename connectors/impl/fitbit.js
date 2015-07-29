var querystring = require('querystring');
var Token = require('../../model/token');
var Fitbit = require('../../model/fitbit');
var request = require('request');
var shared = require('../shared');
var async = require('async');
var _ = require('underscore');
var moment = require('moment');

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
	shared.doTokenExchange(url, params, _getClientAuthHeader(), 'fitbit',
		callback);
};

module.exports.backfill = function(callback) {
	Token.findOne({service: 'fitbit'}, function(err, token) {
		if (err) return callback(err);
		if (!token) return callback();
		_fetchLastYear(token.accessToken, function(err) {
			_log('Finished backfill');
			callback(err);
		});
	});
};

module.exports.crawl = function(callback) {
	Token.findOne({service: 'fitbit'}, function(err, token) {
		if (err) return callback(err);
		if (!token) return callback();
		_fetchLatest(token, function(err) {
			_log('Finished crawl');
			callback(err);
		});
	});
};

// Private

var _shouldRefreshToken = "SHOULD_REFRESH_TOKEN";

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
	shared.doTokenExchange(url, params, _getClientAuthHeader(), 'fitbit',
		callback);
}


function _fitbitApiCall(url, accessToken, callback) {
	request.get({url: url,
				 headers: {'Authorization': 'Bearer ' + accessToken}},
		function(err, response, body) {
			if (err)
				return callback(err);
			var json = JSON.parse(body);
			if (response.statusCode == 200)
				return callback(null, json);
			else if (response.statusCode == 401)
				return callback(new Error(_shouldRefreshToken));
			else if (response.statusCode == 429)
				return callback(new Error('Reached rate limit'));
			else
				return callback(new Error(JSON.stringify(json)));
		});
}

/*
Fetches activity summaries (which exclude heart rate) for today and yesterday,
merges them with heart rate data, and stores in the DB. In total, this hits 3
endpoints. Also, Fitbit tokens only last an hour, so we might need to refresh
the token too.
*/
function _fetchLatest(token, callback) {
	_log('Fetching today and yesterday');
	var todayStr = moment().format('YYYY-MM-DD');
	var todayUrl = "https://api.fitbit.com/1/user/-/activities/date/" +
		todayStr + ".json";
	var yesterdayStr = moment().subtract(1, 'day').format('YYYY-MM-DD');
	var yesterdayUrl = "https://api.fitbit.com/1/user/-/activities/date/" +
		yesterdayStr + ".json";
	var heartUrl = "https://api.fitbit.com/1/user/-/activities/heart/date/today/7d.json";
	async.parallel([
		function(callback) { _fitbitApiCall(todayUrl, token.accessToken, callback); },
		function(callback) { _fitbitApiCall(yesterdayUrl, token.accessToken, callback); },
		function(callback) { _fitbitApiCall(heartUrl, token.accessToken, callback); }
	],
	function(err, results) {
		if (err) {
			if (err.message === _shouldRefreshToken) {
				return _refreshAccessToken(token.refreshToken, function(err) {
					if (err) return callback(err);
					module.exports.crawl(callback);
				});
			} else {
				return callback(err);
			}
		}
		_log('Processing results');
		var today = results[0].summary;
		var yesterday = results[1].summary;
		var heartTimeSeries = results[2];

		var heartArr = _getTransformOfArrayOfTimeseriesResponses([heartTimeSeries]);
		_formatSummary(todayStr, today, heartArr);
		_formatSummary(yesterdayStr, yesterday, heartArr);

		_storeTransformedData([today, yesterday], callback);
	});
}

function _renameKey(obj, from, to) {
	obj[to] = obj[from];
	delete obj[from];
}

/*
Formats the summary returned by Fitbit to the DB schema.
*/
function _formatSummary(dateStr, summaryObj, heartArr) {
	summaryObj.dateTime = new Date(dateStr);
	_renameKey(summaryObj, 'caloriesOut', 'calories');
	var distance = _.filter(summaryObj.distances,
		function(x) { return x.activity == "total"; });
	summaryObj.distance = distance[0].distance;
	delete summaryObj.distances;
	_renameKey(summaryObj, 'sedentaryMinutes', 'minutesSedentary');
	_renameKey(summaryObj, 'lightlyActiveMinutes', 'minutesLightlyActive');
	_renameKey(summaryObj, 'fairlyActiveMinutes', 'minutesFairlyActive');
	_renameKey(summaryObj, 'veryActiveMinutes', 'minutesVeryActive');
	delete summaryObj.activeScore;
	delete summaryObj.marginalCalories;
	var heart = _.filter(heartArr,
		function(x) {
			return x.dateTime.getTime() == summaryObj.dateTime.getTime();
		});
	summaryObj.heart = heart[0].heart;
}

/*
Backfill the last year of data. This is rather expensive as it hits 12
endpoints!
*/
function _fetchLastYear(accessToken, callback) {
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
	var urls = fragments.map( s => "https://api.fitbit.com/1/user/-/activities/" +
									s + "/date/today/1y.json");
	var data = [];
	async.each(urls, function(url, callback) {
		_fitbitApiCall(url, accessToken, function(err, json) {
			if (err) return callback(err);
			data.push(json);
			callback();
		});
	}, function(err) {
		if (err) return callback(err);
		var transformed = _getTransformOfArrayOfTimeseriesResponses(data);
		transformed = _.filter(transformed, function(x) { return x.steps > 0; });
		_storeTransformedData(transformed, callback);
	});
}

/*
Transforms an array of timeseries API responses into an array of day summaries.
*/
function _getTransformOfArrayOfTimeseriesResponses(data) {
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
	return _.values(reducedObj);
}

/*
Stores an array of data in the DB.
*/
function _storeTransformedData(arr, callback) {
	async.each(arr, function(summary, callback) {
		Fitbit.findOneAndUpdate({dateTime: summary.dateTime}, summary,
			{upsert: true}, callback);
	}, callback);
}
