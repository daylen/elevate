var express = require('express');
var router = express.Router();

var Fitbit = require('../model/fitbit');
var Strava = require('../model/strava');
var _ = require('underscore');

router.get('/activity', function(req, res, next) {
	if (!req.query.date) return next(new Error('date param is required'));
	var dateObj = new Date(req.query.date);

	Fitbit.findOne({dateTime: dateObj}, function(err, data) {
		if (err) return next(err);
		res.json({
			'date': req.query.date,
			'summary': _.pick(data, globalConfig.fitbit.exposed),
			'workouts': []
		});
	});
	
	// TODO
});

module.exports = router;
