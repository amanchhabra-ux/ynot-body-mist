/* Tells the page whether card payments are switched on.
   Until Razorpay keys exist in the environment this reports live:false and the
   site quietly keeps its original WhatsApp pre-order flow — so deploying the
   checkout before the merchant account is ready breaks nothing. */

const L = require('./_lib.js');

module.exports = function handler(req, res){
  res.setHeader('Cache-Control', 'no-store');
  L.json(res, 200, {
    live:  L.LIVE,
    test:  L.TEST_MODE,
    keyId: L.LIVE ? L.KEY_ID : null,          // the publishable key only; the secret never leaves the server
    price: L.PRICE,
    currency: 'INR'
  });
};
