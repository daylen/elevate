var querystring = require('querystring');
var shared = require('../shared');
var Token = require('../../model/token');
var request = require('request');
var logger = require('../../logger');
var async = require('async');
var Jawbone = require('../../model/jawbone');

module.exports.getAuthUrl = function(redirectFragment) {
	var base = "https://jawbone.com/auth/oauth2/auth?";
	var params = {
		'client_id': globalConfig.jawbone.client_id,
		'redirect_uri': globalConfig.oauth_redirect_base + redirectFragment,
		'response_type': 'code',
		'scope': 'basic_read extended_read location_read friends_read mood_read move_read sleep_read meal_read weight_read generic_event_read heartrate_read'
	};
	return base + querystring.stringify(params);
};

module.exports.doTokenExchange = function(authCode, callback) {
	var url = 'https://jawbone.com/auth/oauth2/token';
	var params = {
		'client_id': globalConfig.jawbone.client_id,
		'client_secret': globalConfig.jawbone.client_secret,
		'grant_type': 'authorization_code',
		'code': authCode
	};
	shared.doTokenExchange(url, params, {}, 'jawbone', callback);
};

module.exports.backfill = function(callback) {
	module.exports.crawl(callback);
};

module.exports.crawl = function(callback) {
	_log('Begin crawl');
	Token.findOne({service: 'jawbone'}, function(err, token) {
		if (err) return callback(err);
		if (!token) return callback();
		_fetchFromEndpoint('/nudge/api/v.1.1/users/@me/trends', {
			num_buckets: 30
		}, token.accessToken, function(err) {
			_log('Finished crawl');
			callback(err);
		});
	});
};

// Private

var _base = "https://jawbone.com";

function _log(str) {
	logger.info('[Jawbone] ' + str);
}

function _logError(str) {
	logger.error('[Jawbone] ' + str);
}

function _fetchFromEndpoint(endpoint, params, accessToken, callback) {
	request.get({url: _base + endpoint,
		qs: params,
		headers: {'Authorization': 'Bearer ' + accessToken}},
		function(err, response, body) {
			if (err) return callback(err);
			var json;
			try {
				json = JSON.parse(body);
			} catch(e) {
				return callback(e);
			}
			if (json.meta.code != 200) {
				return callback(new Error(json.meta.error_detail));
			}
			_log('Got ' + json.data.data.length + ' days');

			_processDataArray(json.data.earliest, json.data.data,
				function(err, continueCrawling) {
				if (err) return callback(err);
				if (continueCrawling) {
					_log('Continuing to crawl');
					// Recursion, because why not
					_fetchFromEndpoint(json.data.links.next, {}, accessToken, callback);
				} else {
					callback();
				}
			});

		});
}

function _dateIntegerToDateObj(number) {
	// Wow, really Jawbone?
	var day = number % 100;
	var month = Math.floor(number / 100) % 100;
	var year = Math.floor(number / 10000);
	return new Date(Date.UTC(year, month - 1, day));
}

/*
callback(err, continueCrawling)
*/
function _processDataArray(earliest, arr, callback) {
	var processed = [];
	var earliestDate = _dateIntegerToDateObj(earliest);
	var wentTooFarBackInTime = false;

	for (var dayArr of arr) {
		if (dayArr.length != 2) {
			_logError('Expected 2 values, got ' + dayArr.length);
			continue;
		}
		var dateObj = _dateIntegerToDateObj(dayArr[0]);
		if (dateObj < earliestDate) {
			wentTooFarBackInTime = true;
		}
		var data = dayArr[1];
		if (!data.m_steps || data.m_steps === 0) {
			continue;
		}
		var summaryObj = {
			dateTime: dateObj,
			calories: data.m_total_calories,
			caloriesBMR: data.bmr,
			activityCalories: data.m_calories,
			steps: data.m_steps,
			distance: data.m_distance,
			activeTime: data.m_active_time
		};
		processed.push(summaryObj);
	}
	if (processed.length === 0) {
		// Welp, looks like you stopped using Jawbone
		return callback(null, !wentTooFarBackInTime);
	}
	_storeData(processed, function(err, thereWasAnUpdate) {
		if (err) return callback(err);
		callback(null, thereWasAnUpdate && !wentTooFarBackInTime);
	});
}

/*
callback(err, thereWasAnUpdate)
*/
function _storeData(arr, callback) {
	var thereWasAnUpdate = false;
	async.each(arr, function(summary, callback) {
		Jawbone.findOneAndUpdate({dateTime: summary.dateTime}, summary,
			{'new': false, upsert: true}, function(err, doc) {
				if (err) return callback(err);
				if (!doc) {
					_log('Adding new summary!');
					thereWasAnUpdate = true;
				}
				callback();
			});
	}, function(err) {
		if (err) return callback(err);
		callback(null, thereWasAnUpdate);
	});
}
