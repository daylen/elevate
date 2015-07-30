var winston = require('winston');

var logger = new winston.Logger({
	transports: [
		new winston.transports.File({
			level: 'info',
			filename: './log.log',
			handleExceptions: true,
			json: true,
			maxsize: 5242880,
			maxFiles: 5,
			colorize: false
		}),
		new winston.transports.Console({
			level: 'debug',
			handleExceptions: true,
			json: false,
			colorize: true
		})
	]
});

module.exports = logger;
