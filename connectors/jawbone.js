var querystring = require('querystring');

module.exports.authRequestUrl = function(redirect_fragment) {
	var base = "https://jawbone.com/auth/oauth2/auth?";
	var params = {
		'client_id': globalConfig.jawbone.client_id,
		'redirect_uri': globalConfig.oauth_redirect_base + redirect_fragment,
		'response_type': 'code',
		'scope': 'basic_read extended_read location_read friends_read mood_read move_read sleep_read meal_read weight_read generic_event_read heartrate_read'
	};
	return base + querystring.stringify(params);
}