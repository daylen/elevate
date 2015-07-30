var mongoose = require('mongoose');

var jawboneSchema = mongoose.Schema({
	dateTime: Date,
	// calories
	calories: Number,
	caloriesBMR: Number, // resting calories
	activityCalories: Number,
	// stepping
	steps: Number,
	distance: Number,
	// minutes
	activeTime: Number
});

module.exports = mongoose.model('Jawbone', jawboneSchema);