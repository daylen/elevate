var express = require('express');
var router = express.Router();

var Fitbit = require('../model/fitbit');
var Jawbone = require('../model/jawbone');
var Strava = require('../model/strava');
var _ = require('underscore');
var async = require('async');
var logger = require('../logger');
var moment = require('moment');

router.get('/activity', function(req, res, next) {
	if (!req.query.date)
		return next(new Error('date param is required'));
	if (isNaN(Date.parse(req.query.date)))
		return next(new Error('could not parse date'));
	var dateObj = new Date(req.query.date);

	async.parallel([
		function(callback) {
			_genSummaryForDate(dateObj, function(err, summary) {
				if (err) return callback(err);
				callback(null, summary);
			});
		},
		function(callback) {
			_genActivitiesForDate(req.query.date, function(err, activities) {
				if (err) return callback(err);
				callback(null, activities);
			});
		}
	], function(err, results) {
		if (err) return next(err);
		res.json({
			date: req.query.date,
			summary: results[0],
			activities: results[1]
		});
	});
});

function _genActivitiesForDate(dateStr, callback) {
	logger.info('Generating activities for ' + dateStr);
	var startDate = moment(dateStr);
	var endDate = moment(dateStr).add(1, 'day');
	Strava.find({
		start_date_local: {$gte: startDate, $lt: endDate}
	}, function(err, activities) {
		if (err) return callback(err);
		logger.info('Found ' + activities.length + ' activities');
		var activityObjects = _.map(activities, function(a) {
			var b = a.toObject();
			b = _.omit(b, 'start_latlng', 'end_latlng', '_id', '__v', 'external_id', 'has_kudoed', 'total_photo_count', 'gear_id', 'photo_count', 'start_longitude', 'start_latitude', 'upload_id', 'resource_state');
			return b;
		});
		return callback(null, activityObjects);
	});
}

function _genSummaryForDate(dateObj, callback) {
	async.parallel([
		function(callback) {
			Fitbit.findOne({dateTime: dateObj}, function(err, data) {
				if (err) return next(err);
				if (!data) return callback(null, null);
				callback(null, data.toObject({transform: true}));
			});
		},
		function(callback) {
			Jawbone.findOne({dateTime: dateObj}, function(err, data) {
				if (err) return next(err);
				if (!data) return callback(null, null);
				callback(null, data.toObject({transform: true}));
			});
		},
	], function(err, results) {
		if (err) return next(err);
		results = _.filter(results, function(x) { return !!x; });
		var maxData = _.max(results, function(x) {
			return x.steps;
		});
		callback(null, maxData);
	});
}

module.exports = router;
