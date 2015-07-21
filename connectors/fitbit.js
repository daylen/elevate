var querystring = require('querystring');

module.exports.authRequestUrl = function(redirect_fragment) {
	var base = "https://www.fitbit.com/oauth2/authorize?";
	var params = {
		'client_id': globalConfig.fitbit.client_id,
		'response_type': 'code',
		'scope': 'activity heartrate location nutrition profile settings sleep social weight',
		'redirect_uri': globalConfig.oauth_redirect_base + redirect_fragment
	};
	return base + querystring.stringify(params);
}