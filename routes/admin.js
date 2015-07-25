var express = require('express');
var router = express.Router();
var auth = require('http-auth');
var request = require('request');
var basic = auth.basic({
	realm: 'settings'
}, function(username, password, callback) {
	callback(username === globalConfig.admin.username &&
		password === globalConfig.admin.password);
});
var Token = require('../model/token');
var connectors = require('../connectors/connectors');


function getHtmlLink(label, url) {
	return '<a href="' + url + '">' + label + '</a>';
}

router.get('/', auth.connect(basic), function(req, res, next) {
	var services = {
		'fitbit': getHtmlLink('Connect Fitbit', connectors.fitbit.authRequestUrl('/admin/fitbit')),
		'jawbone': getHtmlLink('Connect Jawbone', connectors.jawbone.authRequestUrl('/admin/jawbone')),
		'strava': getHtmlLink('Connect Strava', connectors.strava.authRequestUrl('/admin/strava'))
	};
	Token.find({}, function(err, tokens) {
		if (err) return next(err);
		for (token of tokens) {
			services[token.service] = 'Connected';
		}
		res.render('admin', services);
	});
});

function doTokenExchange(url, params, service, res, next, headers) {
	request.post({url: url, form: params, headers: headers}, function(err, response, body) {
		if (err) return next(err);
		var json = JSON.parse(body);
		if (!json.access_token) {
			console.log(json);
			return next(new Error('Access token is null'));
		}
		Token.findOneAndUpdate(
			{service: service},
			{accessToken: json.access_token,
			 refreshToken: json.refresh_token},
			{upsert: true},
			function(err) {
				if (err) return next(err);
				res.redirect('/admin');
			});
	});
}

router.get('/fitbit', function(req, res, next) {
	// Fitbit wants an Authorization header during the token exchange
	var url = 'https://api.fitbit.com/oauth2/token';
	var params = {
		'client_id': globalConfig.fitbit.client_id,
		'grant_type': 'authorization_code',
		'code': req.query.code,
		'redirect_uri': globalConfig.oauth_redirect_base + '/admin/fitbit'
	};
	var authHeader = new Buffer(globalConfig.fitbit.client_id + ':' +
		globalConfig.fitbit.client_secret).toString('base64');
	doTokenExchange(url, params, 'fitbit', res, next, {'Authorization': 'Basic ' + authHeader});
});

router.get('/jawbone', function(req, res, next) {
	var url = 'https://jawbone.com/auth/oauth2/token';
	var params = {
		'client_id': globalConfig.jawbone.client_id,
		'client_secret': globalConfig.jawbone.client_secret,
		'grant_type': 'authorization_code',
		'code': req.query.code
	};
	doTokenExchange(url, params, 'jawbone', res, next);
});

router.get('/strava', function(req, res, next) {
	var url = 'https://www.strava.com/oauth/token';
	var params = {
		'client_id': globalConfig.strava.client_id,
		'client_secret': globalConfig.strava.client_secret,
		'code': req.query.code
	};
	doTokenExchange(url, params, 'strava', res, next);
});

router.post('/sync', function(req, res, next) {
	var service = req.body.service;
	console.log('[Debug] Triggering sync for ' + service);
	// Note: crawl() could throw an error
	if (service == 'fitbit') {
		connectors.fitbit.crawl();
	} else if (service == 'jawbone') {
		connectors.jawbone.crawl();
	} else if (service == 'strava') {
		connectors.strava.crawl();
	}
	res.redirect('/admin');
});

module.exports = router;
