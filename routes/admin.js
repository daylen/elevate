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
var connectors = require('../connectors');

function _makeHtmlLink(label, url) {
	return '<a href="' + url + '">' + label + '</a>';
}

router.get('/', auth.connect(basic), function(req, res, next) {
	var services = {
		'fitbit': _makeHtmlLink('Connect Fitbit',
			connectors.fitbit.getAuthUrl('/admin/fitbit')),
		'jawbone': _makeHtmlLink('Connect Jawbone',
			connectors.jawbone.getAuthUrl('/admin/jawbone')),
		'strava': _makeHtmlLink('Connect Strava',
			connectors.strava.getAuthUrl('/admin/strava'))
	};
	Token.find({}, function(err, tokens) {
		if (err) return next(err);
		for (token of tokens) {
			services[token.service] = 'Connected';
		}
		res.render('admin', services);
	});
});

router.get('/fitbit', function(req, res, next) {
	connectors.fitbit.doTokenExchange(req.query.code, function(err) {
		if (err) return next(err);
		res.redirect('/admin');
	});
});

router.get('/jawbone', function(req, res, next) {
	connectors.jawbone.doTokenExchange(req.query.code, function(err) {
		if (err) return next(err);
		res.redirect('/admin');
	});
});

router.get('/strava', function(req, res, next) {
	connectors.strava.doTokenExchange(req.query.code, function(err) {
		if (err) return next(err);
		res.redirect('/admin');
	});
});

router.post('/sync', function(req, res, next) {
	connectors.crawlNow(function(err) {
		if (err) return next(err);
		res.redirect('/admin');	
	});
});

module.exports = router;
