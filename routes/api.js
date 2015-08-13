var express = require('express');
var router = express.Router();

var Fitbit = require('../model/fitbit');
var Jawbone = require('../model/jawbone');
var Strava = require('../model/strava');
var _ = require('underscore');
var async = require('async');
var logger = require('../logger');
var moment = require('moment-timezone');
var querystring = require('querystring');

router.get('/name', function(req, res, next) {
	res.json({
		name: globalConfig.name
	});
});

router.get('/activity', function(req, res, next) {
	var fromStr;
	var toStr;
	if (req.query.from && req.query.to) {
		fromStr = req.query.from;
		toStr = req.query.to;
	} else {
		// Use default date range
		fromStr = moment().tz(globalConfig.timezone).subtract(1, 'month').format('YYYY-MM-DD');
		toStr = moment().tz(globalConfig.timezone).format('YYYY-MM-DD');
	}
	// Generate all date strings
	var dateStrs = [fromStr];
	while (moment(_.last(dateStrs)).isBefore(toStr)) {
		dateStrs.push(moment(_.last(dateStrs)).add(1, 'day').format('YYYY-MM-DD'));
	}
	// Calculate pagination url
	var url = '/api/v1/activity?';
	var newToStr = moment(fromStr).subtract(1, 'day').format('YYYY-MM-DD');
	var newFromStr = moment(newToStr).subtract(1, 'month').format('YYYY-MM-DD');
	var paginationParams = {
		from: newFromStr,
		to: newToStr
	};
	url += querystring.stringify(paginationParams);

	// Parallel generate
	async.map(dateStrs, _genResponseForDate, function(err, results) {
		if (err) return next(err);
		res.json({
			activities: results,
			next: url
		});
	});

});

router.get('/activity/:date', function(req, res, next) {
	if (!req.params.date)
		return next(new Error('date param is required'));
	if (isNaN(Date.parse(req.params.date)))
		return next(new Error('could not parse date'));
	_genResponseForDate(req.params.date, function(err, json) {
		if (err) return next(err);
		res.json(json);
	});
});

function _genResponseForDate(dateStr, callback) {
	var dateObj = new Date(dateStr);
	async.parallel([
		function(callback) {
			_genSummaryForDate(dateObj, function(err, summary) {
				if (err) return callback(err);
				callback(null, summary);
			});
		},
		function(callback) {
			_genActivitiesForDate(dateStr, function(err, activities) {
				if (err) return callback(err);
				callback(null, activities);
			});
		}
	], function(err, results) {
		if (err) return callback(err);
		callback(null, {
			date: dateStr,
			summary: results[0],
			activities: results[1]
		});
	});
}

function _genActivitiesForDate(dateStr, callback) {
	var startDate = moment(dateStr);
	var endDate = moment(dateStr).add(1, 'day');
	Strava.find({
		start_date_local: {$gte: startDate, $lt: endDate}
	}, function(err, activities) {
		if (err) return callback(err);
		var activityObjects = _.map(activities, function(a) {
			var b = a.toObject();
			b = _.omit(b, 'start_latlng', 'end_latlng', '_id', '__v',
				'external_id', 'has_kudoed', 'total_photo_count', 'gear_id',
				'photo_count', 'start_longitude', 'start_latitude', 'upload_id',
				'resource_state');
			return b;
		});
		return callback(null, activityObjects);
	});
}

function _genSummaryForDate(dateObj, callback) {
	async.parallel([
		function(callback) {
			Fitbit.findOne({dateTime: dateObj}, function(err, data) {
				if (err) return callback(err);
				if (!data) return callback(null, null);
				callback(null, data.toObject({transform: true}));
			});
		},
		function(callback) {
			Jawbone.findOne({dateTime: dateObj}, function(err, data) {
				if (err) return callback(err);
				if (!data) return callback(null, null);
				callback(null, data.toObject({transform: true}));
			});
		},
	], function(err, results) {
		if (err) return callback(err);
		results = _.filter(results, function(x) { return !!x; });
		if (results.length > 0) {
			var maxData = _.max(results, function(x) {
				return x.steps;
			});
			callback(null, maxData);
		} else {
			callback(null, {});
		}
		
	});
}

module.exports = router;
