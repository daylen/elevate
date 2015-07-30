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
var logger = require('../logger');

function _makeHtmlLink(label, url) {
	return '<a href="' + url + '">' + label + '</a>';
}

function _logIfError(err) {
	if (err) logger.error(err);
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
		for (var token of tokens) {
			services[token.service] = 'Connected <a href="/admin/disconnect?service=' +
				token.service + '">Disconnect</a>';
		}
		res.render('admin', services);
	});
});

router.get('/fitbit', function(req, res, next) {
	connectors.fitbit.doTokenExchange(req.query.code, function(err) {
		if (err) return next(err);
		res.redirect('/admin');
		connectors.fitbit.backfill(_logIfError);
	});
});

router.get('/jawbone', function(req, res, next) {
	connectors.jawbone.doTokenExchange(req.query.code, function(err) {
		if (err) return next(err);
		res.redirect('/admin');
		connectors.jawbone.backfill(_logIfError);
	});
});

router.get('/strava', function(req, res, next) {
	connectors.strava.doTokenExchange(req.query.code, function(err) {
		if (err) return next(err);
		res.redirect('/admin');
		connectors.strava.backfill(_logIfError);
	});
});

router.get('/disconnect', function(req, res, next) {
	Token.findOneAndRemove({service: req.query.service}, function(err) {
		if (err) return next(err);
		res.redirect('/admin');
	});
});

router.post('/crawl', function(req, res, next) {
	connectors.crawlNow(function(err) {
		if (err) return next(err);
		res.redirect('/admin');	
	});
});

module.exports = router;
