const express = require('express');
const path = require('path');
const app = express();
const https = require('https');

const PaytmChecksum = require('./Paytm/checksum');

app.use(express.json());
app.use(express.urlencoded({ extended:false }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname + '/index.html'));
});

const PaytmConfig = {
  mid: process.env.MERCHANT_ID,
  key: process.env.MERCHANT_KEY,
  website: 'WEBSTAGING'
};

app.post('/payment', (req, res) => {
  // Route for making payment
  try {
    const orderId = 'TEST_' + new Date().getTime();
    let data = req.body;

    const paytmParams = {};

    paytmParams.body = {
      'requestType': 'Payment',
      'mid': PaytmConfig.mid,
      'websiteName': PaytmConfig.website,
      'orderId': orderId,
      'callbackUrl': 'http://localhost:3000/callback',
      'txnAmount': {
        'value': data.amount,
        'currency': 'INR',
      },
      'userInfo': { 'custId': data.email, },
    };

    PaytmChecksum.generateSignature(JSON.stringify(paytmParams.body), PaytmConfig.key).then(function (checksum) {

      paytmParams.head = { 'signature': checksum };

      var post_data = JSON.stringify(paytmParams);

      var options = {

        /* for Staging */
        hostname: 'securegw-stage.paytm.in',

        /* for Production */
        // hostname: 'securegw.paytm.in',

        port: 443,
        path: `/theia/api/v1/initiateTransaction?mid=${PaytmConfig.mid}&orderId=${orderId}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': post_data.length
        }
      };

      var response = '';
      var post_req = https.request(options, function (post_res) {
        post_res.on('data', function (chunk) {
          response += chunk;
        });

        post_res.on('end', function () {
          response = JSON.parse(response);

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.write(`<html>
                                <head>
                                    <title>Show Payment Page</title>
                                </head>
                                <body>
                                    <center>
                                        <h1>Please do not refresh this page...</h1>
                                    </center>
                                    <form method="post" action="https://securegw-stage.paytm.in/theia/api/v1/showPaymentPage?mid=${PaytmConfig.mid}&orderId=${orderId}" name="paytm">
                                        <table border="1">
                                            <tbody>
                                                <input type="hidden" name="mid" value="${PaytmConfig.mid}">
                                                    <input type="hidden" name="orderId" value="${orderId}">
                                                    <input type="hidden" name="txnToken" value="${response.body.txnToken}">
                                         </tbody>
                                      </table>
                                                    <script type="text/javascript"> document.paytm.submit(); </script>
                                   </form>
                                </body>
                             </html>`);
          res.end();
        });
      });

      post_req.write(post_data);
      post_req.end();
    });

  } catch (error) {
    console.log(error.message);
  }
});
app.post('/callback', (req, res) => {
  // Route for verifying payment
  try {
    let data = JSON.parse(JSON.stringify(req.body));

    const paytmChecksum = data.CHECKSUMHASH;

    var isVerifySignature = PaytmChecksum.verifySignature(data, PaytmConfig.key, paytmChecksum);
    if (isVerifySignature) {
      console.log('Checksum Matched');

      var paytmParams = {};

      paytmParams.body = {
        'mid': PaytmConfig.mid,
        'orderId': data.ORDERID,
      };

      PaytmChecksum.generateSignature(JSON.stringify(paytmParams.body), PaytmConfig.key).then(function (checksum) {
        paytmParams.head = { 'signature': checksum };

        var post_data = JSON.stringify(paytmParams);

        var options = {

          /* for Staging */
          hostname: 'securegw-stage.paytm.in',

          /* for Production */
          // hostname: 'securegw.paytm.in',

          port: 443,
          path: '/v3/order/status',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': post_data.length
          }
        };

        // Set up the request
        var response = '';
        var post_req = https.request(options, function (post_res) {
          post_res.on('data', function (chunk) {
            response += chunk;
          });

          post_res.on('end', function () {
            res.write(response);
            res.end();
          });
        });

        // post the data
        post_req.write(post_data);
        post_req.end();
      });
    } else {
      console.log('Checksum Mismatched');
    }
  } catch (error) {
    console.log(error.message);
  }
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});