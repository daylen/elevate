var express = require('express');
var router = express.Router();

var Fitbit = require('../model/fitbit');
var Jawbone = require('../model/jawbone');
var Strava = require('../model/strava');
var _ = require('underscore');
var async = require('async');
var logger = require('../logger');

router.get('/activity', function(req, res, next) {
	if (!req.query.date) return next(new Error('date param is required'));
	var dateObj = new Date(req.query.date);

	// TODO Strava
	_genSummaryForDate(dateObj, function(err, summary) {
		if (err) return next(err);
		res.json({
			'date': req.query.date,
			'summary': summary
		});
	});

});

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
