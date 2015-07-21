var express = require('express');
var router = express.Router();
var auth = require('http-auth');
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
		'fitbit': getHtmlLink('Connect', connectors.fitbit.authRequestUrl('/admin/fitbit')),
		'jawbone': getHtmlLink('Connect', connectors.jawbone.authRequestUrl('/admin/jawbone')),
		'strava': getHtmlLink('Connect', connectors.strava.authRequestUrl('/admin/strava'))
	};
	Token.find({}, function(err, tokens) {
		if (err) return next(err);
		for (token of tokens) {
			services[token.service] = 'Connected';
		}
		res.render('admin', services);
	});
	
});

module.exports = router;
