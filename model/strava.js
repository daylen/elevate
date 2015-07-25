var mongoose = require('mongoose');

module.exports = mongoose.model('Strava', new mongoose.Schema({}, {strict: false}));