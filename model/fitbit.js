var mongoose = require('mongoose');

var fitbitSchema = mongoose.Schema({
	date: Date,
	// calories
	calories: Number,
	caloriesBMR: Number, // resting calories
	activityCalories: Number,
	// stepping
	steps: Number,
	distance: Number,
	// climbing
	floors: Number,
	elevation: Number,
	// heart
	restingHeartRate: Number,
	heartRateZones: Array,
	// minutes
	minutesSedentary: Number,
	minutesLightlyActive: Number,
	minutesFairlyActive: Number,
	minutesVeryActive: Number
});

module.exports = mongoose.model('Fitbit', fitbitSchema);