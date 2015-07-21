var querystring = require('querystring');

module.exports.authRequestUrl = function(redirect_fragment) {
	var base = "https://www.strava.com/oauth/authorize?";
	var params = {
		'client_id': globalConfig.strava.client_id,
		'redirect_uri': globalConfig.oauth_redirect_base + redirect_fragment,
		'response_type': 'code',
		'scope': 'view_private'
	};
	return base + querystring.stringify(params);
}