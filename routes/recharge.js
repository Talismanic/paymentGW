var express = require('express');
var db = require('../dbconnect');
var router = express.Router();
var bodyParser=require('body-parser');
var request = require('request');
var queue = require('../queue');
var uuidv1 = require('uuid/v1');



router.post('/', function(req, res, next){

	var msisdn = req.body.msisdn;
	var amount = req.body.amount;
	var channelName = req.body.channelName;
	var refillId = "T1"
	var transactionId = uuidv1();
	// console.log(transactionId);
	



	const job = queue.create(
		'normalRecharge',
		{
			msisdn: msisdn,
			amount: amount,
			channel: channelName,
			refill: refillId,
			txnId: transactionId

		})
	.removeOnComplete(true)
	.attempts(3)
	.backoff({delay:60*1000, type: 'exponential' })
	.delay(30*1000)
	.save( function(err){
		if( !err ) console.log( "Job %s got queued of type %s", job.id, job.type );
	});

	queue.on('job enqueue', function(id, type){
		console.log( 'Job %s got queued of type %s', id, type );
	});



	var response = {"status": "pending"};
	res.status (201);
	res.json(response);

});


module.exports = router;