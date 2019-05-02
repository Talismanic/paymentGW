var express = require('express');
var db = require('../dbconnect');
var router = express.Router();
var bodyParser=require('body-parser');
var request = require('request');
var options = { method: 'POST',
url: 'https://checkout.sandbox.bka.sh/v1.2.0-beta/checkout/payment/create',
  headers: 
   { 'x-app-key': 'X-APP-Key',
     authorization: 'Authorization' 
   } 
 };



/* Saying Hello. */
router.get('/', function(req, res, next) {
  res.send('Hello from the other side');
});


//Creating Invoices

router.post('/createInvoice', function(req, res, next){
  //console.log(req.body.msisdn);
  var invoiceId = req.body.invoiceId;
  var channelName = req.body.channelName;
  var customerReferrence = req.body.customerReferrence;
  var purchaseDescription = req.body.purchaseDescription;
  var transactionAmount = req.body.transactionDetails.amount;
  var transactionUnit = req.body.transactionDetails.unit;
  var purpose = req.body.transactionDetails.purpose
  var products = req.body.products;
  var successRedirect = req.body.successRedirect;
  var cancelRedirect = req.body.cancelRedirect;

  var sofResponse = getSofResponse ( transactionAmount, successRedirect, cancelRedirect, invoiceId);
  var sofUrl = sofResponse.url;
  var sofPaymentId = sofResponse.sofPaymentId
  console.log(sofUrl);

  transactionInsert(invoiceId,channelName,customerReferrence,transactionAmount,transactionUnit,successRedirect,cancelRedirect,sofUrl,status=1, sofPaymentId, function(err, result){
    if(err){
      console.log(err.sqlMessage);
      var errorMessage = {"status": "failed", "message": err.sqlMessage};
      res.statusCode = 403;
      res.json(errorMessage);

    }
    else{
      var resBody = {"status": "success","invoiceId": invoiceId, "link": sofUrl};
      res.statusCode = 201;
      res.json(resBody);
    }
  });

});


// Accepting Call backs from SoF

router.post('/paymentSuccess', function(req, res, next){

    var paymentId = req.body.paymentId;
    var transactionId = req.body.transactionId;
    var transactionStatus = req.body.transactionStatus;
    var amount = req.body.amount;
    var merchantInvoiceNumber = req.body.merchantInvoiceNumber;

    if (transactionStatus == "authorized"){
      status = 2;
    } 
    else {
      status = 0;
    }
    console.log(status);

    findTransaction(merchantInvoiceNumber, function(err, result){
      if (err){
        console.log(err);
        var errorMessage = {"status": "failed", "step":"find invoice", "message":err.sqlMessage};
        res.statusCode =403;
        res.json(errorMessage);
      }
      if (result.length>0){
        console.log(result);
        var customerReferrence = result[0].customer_referrence;
        var currency = result[0].unit;
        var intent = result[0].intent;
        
        // Updating transaction status

        updateTransactionStatus(merchantInvoiceNumber, status, function(err, result){
          if (err || result.affectedRows == 0){
            console.log(err);
            if(err){
              var errorMessage = {"status": "failed","step":"transaction update", "message":err.sqlMessage, "remarks":"transactions update failed"};
            }
            else {
              var errorMessage = {"status": "failed", "step":"transaction update", "message":"Transaction not found",  "remarks":"invoice  not found"};
            }
            res.statusCode =403;
            res.json(errorMessage);
          }
          else{
            // console.log(result);

            //inserting payment success in payment table

            paymentInsert(merchantInvoiceNumber,paymentId,customerReferrence, transactionId,amount,currency,intent, function(err, result){

              if(err){
                // console.log(err.sqlMessage);
                var errorMessage = {"status": "failed", "step":"payment insert", "message": err.sqlMessage, "remarks":"payment insertion failed" };
                res.statusCode = 403;
                res.json(errorMessage);
              }
              else{

                // recharging the msisdn

              postRecharge (customerReferrence, amount,paymentId, merchantInvoiceNumber, currency, function(responseData){

                 // console.log(responseData);   

                if(responseData.status == "success"){

                  var resBody = {"status": "success", "step":"recharge", "paymentId": paymentId, "rechargeId": responseData.rechargeId};
                  res.status = 201;
                  res.json (resBody);
                }
                else{
                  var errorMessage = {"status": "failed", "step":"recharge", "message": responseData.message, "paymentId": paymentId};
                  res.statusCode = 403;
                  res.json(errorMessage);
                }
              });
            }
          });
          }
        });
      }
      else{
        var errorMessage = {"status": "failed", "step":"find invoice", "message":"other error"};
        if(result.length == 0){
          var errorMessage = {"status": "failed", "step":"find invoice", "message":"transaction not found"};
        }

        res.statusCode =403;
        res.json(errorMessage);
      }

    });

  });

// Calling sof for paymentId &  URL

function getSofResponse (transactionAmount, successRedirect, cancelRedirect, invoiceId){

  var sofUrl = {"invoiceId": invoiceId, "url":"http://localhost:3082/2849", "sofPaymentId":"3778f3"};

  return sofUrl;
  
}


// // Recharging the MSISDN


function postRecharge (msisdn, rechargeAmount,paymentId, invoiceId, currency, callback){

  // call recharge api here
  var refillId = "BDT1";
  var rechargeResponse = "Recharge Success";
  var rechargeId = "9491938"
  var rechargeStatus = "submitted"

  rechargeInsert(msisdn,invoiceId,paymentId,rechargeAmount,currency,rechargeResponse, rechargeStatus,refillId, function(err, result){

    if(err){
      var status = "failed"
      var message = err.sqlMessage;

    }

    if(result) {
      var status = "success";
      var message = "Recharge Successful";
    }

    var responseData = {"status": status, "message": message, "rechargeId": rechargeId};
    callback (responseData);

  });


}





// finding transaction in transaction table
function findTransaction (invoiceId, callback){

  var sql_sel='SELECT * FROM transactions where invoice_id=?'
  db.query(sql_sel,invoiceId, function(err,result){
    callback (err, result);
  });
}


// updating status in transaction table

function updateTransactionStatus(invoiceId, status, callback){
      var sql_upd='UPDATE transactions SET status=? where invoice_id=?'
      var req_data=[
      status,
      invoiceId
      ];

      db.query(sql_upd,req_data,function(err,result){
        callback (err, result);      
      });
}



// Inserting tranaction in MySQL DB

function transactionInsert(invoiceId,channelName,customerReferrence,transactionAmount,transactionUnit,successRedirect,cancelRedirect,sofUrl,status, sofPaymentId, callback){
  var sql_ins='INSERT INTO transactions (invoice_id, channel_name, customer_referrence, amount, unit, channel_success_redirect, channel_cancel_redirect, sof_url, status, sof_payment_id) VALUES (?,?,?,?,?,?,?,?,?,?)' ;
    
  var ins_data = [
        invoiceId,
        channelName,
        customerReferrence,
        transactionAmount,
        transactionUnit,
        successRedirect,
        cancelRedirect,
        sofUrl,
        status,
        sofPaymentId
        ];
      
  db.query(sql_ins,ins_data,function(err,result){
   callback (err, result);
 });

}


// Inserting in payment table

function paymentInsert(invoiceId,paymentId,customerReferrence, transactionId,amount,currency,intent, callback){
  var sql_ins='INSERT INTO payments (invoice_id, payment_id, customer_referrence, transaction_id, amount, currency, intent) VALUES (?,?,?,?,?,?,?)' ;
    
  var ins_data = [
        invoiceId,
        paymentId,
        customerReferrence,
        transactionId,
        amount,
        currency,
        intent
        ];
      
  db.query(sql_ins,ins_data,function(err,result){
   callback (err, result);
 });

}


// Inserting in recharges table

function rechargeInsert(msisdn,invoiceId,paymentId,amount,currency,rechargeResponse, rechargeStatus, refillId, callback){
  var sql_ins='INSERT INTO recharges (msisdn, invoice_id, payment_id, amount, unit, recharge_response, recharge_status, refill_id) VALUES (?,?,?,?,?,?,?,?)' ;
    
  var ins_data = [
        msisdn,
        invoiceId,
        paymentId,
        amount,
        currency,
        rechargeResponse,
        rechargeStatus,
        refillId
        ];
      
  db.query(sql_ins,ins_data,function(err,result){
   callback (err, result);
 });

}

module.exports = router;