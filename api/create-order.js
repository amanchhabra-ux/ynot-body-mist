/* Step 1 of checkout: price the cart on the server and open a Razorpay order.
   The browser is never trusted for money — it sends quantities, we send back
   an amount we computed ourselves. */

const L = require('./_lib.js');

module.exports = async function handler(req, res){
  if (req.method !== 'POST') return L.json(res, 405, { error: 'Use POST.' });
  if (!L.LIVE)               return L.json(res, 503, { error: 'gateway_not_configured' });

  let body;
  try { body = await L.readBody(req); }
  catch (e) { return L.json(res, 400, { error: 'Could not read that order.' }); }

  const priced = L.priceCart(body.cart);
  if (priced.error) return L.json(res, 400, { error: priced.error });

  const cust = L.cleanCustomer(body.customer);
  if (cust.bad.length) return L.json(res, 400, { error: 'Just need ' + cust.bad.join(', ') + '.' });

  const receipt = L.receiptNo();
  const c = cust.c;

  let order;
  try {
    order = await L.rzp('/orders', {
      method: 'POST',
      body: JSON.stringify({
        amount:   priced.total * 100,          // paise
        currency: 'INR',
        receipt:  receipt,
        notes: {
          items:   L.itemLine(priced.items),
          bottles: String(priced.count),
          name:    c.name,
          phone:   c.phone,
          email:   c.email,
          address: c.addr,
          city:    c.city,
          pincode: c.pin,
          source:  'getynot.in'
        }
      })
    });
  } catch (e) {
    console.error('razorpay order failed', e.status, e.payload);
    return L.json(res, 502, { error: 'The payment gateway did not respond. Please try again.' });
  }

  return L.json(res, 200, {
    orderId:  order.id,
    amount:   order.amount,
    currency: order.currency,
    receipt:  receipt,
    keyId:    L.KEY_ID,
    items:    priced.items,
    count:    priced.count,
    total:    priced.total,
    customer: c
  });
};
