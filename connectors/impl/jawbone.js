var querystring = require('querystring');
var shared = require('../shared');
var Token = require('../../model/token');

module.exports.getAuthUrl = function(redirectFragment) {
	var base = "https://jawbone.com/auth/oauth2/auth?";
	var params = {
		'client_id': globalConfig.jawbone.client_id,
		'redirect_uri': globalConfig.oauth_redirect_base + redirectFragment,
		'response_type': 'code',
		'scope': 'basic_read extended_read location_read friends_read mood_read move_read sleep_read meal_read weight_read generic_event_read heartrate_read'
	};
	return base + querystring.stringify(params);
}

module.exports.doTokenExchange = function(authCode, callback) {
	var url = 'https://jawbone.com/auth/oauth2/token';
	var params = {
		'client_id': globalConfig.jawbone.client_id,
		'client_secret': globalConfig.jawbone.client_secret,
		'grant_type': 'authorization_code',
		'code': authCode
	};
	shared.doTokenExchange(url, params, {}, 'jawbone', callback);
}

module.exports.crawl = function(callback) {
	Token.findOne({service: 'jawbone'}, function(err, token) {
		if (err) return callback(err);
		if (!token) return callback(new Error('Service is not connected'));
		// TODO
		callback(new Error('Not implemented'));
	});
}