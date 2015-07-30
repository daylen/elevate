var mongoose = require('mongoose');

var fitbitSchema = mongoose.Schema({
	dateTime: Date,
	// calories
	calories: Number,
	caloriesBMR: Number, // resting calories
	activityCalories: Number,
	// stepping
	steps: Number,
	distance: Number, // in kilometers
	// climbing
	floors: Number,
	elevation: Number, // in meters
	// heart
	heart: mongoose.Schema.Types.Mixed,
	// minutes
	minutesSedentary: Number,
	minutesLightlyActive: Number,
	minutesFairlyActive: Number,
	minutesVeryActive: Number
});

fitbitSchema.options.toObject = {};
fitbitSchema.options.toObject.transform = function(doc, ret, options) {
	return {
		dateTime: doc.dateTime,
		calories: doc.calories,
		caloriesBMR: doc.caloriesBMR,
		activityCalories: doc.activityCalories,
		steps: doc.steps,
		distance: doc.distance, // in kilometers
		floors: doc.floors,
		elevation: doc.elevation, // in meters
		heart: doc.heart,
		activeTime: doc.minutesFairlyActive + doc.minutesVeryActive // in minutes
	};
};

module.exports = mongoose.model('Fitbit', fitbitSchema);