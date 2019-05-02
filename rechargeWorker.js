var queue = require('./queue');
// var sleep = require ('sleep');

queue.process('normalRecharge', 5, (job, done) => {

	console.log('working on job %s', job.id);
	console.log(job.data);
	doRecharge(job.data.msisdn, job.data.amount, done);
});


function doRecharge(msisdn, amount, done){

	// sleep.sleep(5);
	console.log("Recharge done ");
	done();

}

