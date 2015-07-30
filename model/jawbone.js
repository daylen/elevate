var mongoose = require('mongoose');

var jawboneSchema = mongoose.Schema({
	dateTime: Date,
	// calories
	calories: Number,
	caloriesBMR: Number, // resting calories
	activityCalories: Number,
	// stepping
	steps: Number,
	distance: Number, // in meters
	// minutes
	activeTime: Number // in seconds
});

jawboneSchema.options.toObject = {};
jawboneSchema.options.toObject.transform = function(doc, ret, options) {
	return {
		dateTime: doc.dateTime,
		calories: doc.calories,
		caloriesBMR: doc.caloriesBMR,
		activityCalories: doc.activityCalories,
		steps: doc.steps,
		distance: doc.distance / 1000.0, // in kilometers
		activeTime: doc.activeTime / 60.0 // in minutes
	}
};

module.exports = mongoose.model('Jawbone', jawboneSchema);