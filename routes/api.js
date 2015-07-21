var express = require('express');
var router = express.Router();

router.get('/summary', function(req, res, next) {
  res.json({
  	'totals': {},
  	'activities': []
  });
});

module.exports = router;
