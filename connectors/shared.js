// Shared utils for connectors

var Token = require('../model/token');
var request = require('request');

module.exports.doTokenExchange =
	function(url, params, headers, service, callback) {
	request.post({url: url, form: params, headers: headers},
		function(err, response, body) {
		if (err) return callback(err);
		var json = JSON.parse(body);
		if (!json.access_token) {
			console.log(json);
			return callback(new Error('Access token is null'));
		}
		Token.findOneAndUpdate(
			{service: service},
			{accessToken: json.access_token,
			 refreshToken: json.refresh_token},
			{upsert: true}, callback);
	});
};