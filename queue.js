var kue = require('kue');
// var redis = require('redis');

let queue = kue.createQueue({
	prefix : "recharge",
	// redis: {
	// 	host: 127.0.0.1,
	// 	port: 6379
	// }
});

module.exports = queue;