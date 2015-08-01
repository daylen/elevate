var mongoose = require('mongoose');

var stravaSchema = mongoose.Schema({
	start_date: Date,
	start_date_local: Date
}, {strict: false});

module.exports = mongoose.model('Strava', stravaSchema);