var mongoose = require('mongoose');

var tokenSchema = mongoose.Schema({
	service: String,
	accessToken: String,
	refreshToken: String
});

module.exports = mongoose.model('Token', tokenSchema);