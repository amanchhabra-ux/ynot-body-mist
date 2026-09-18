/* Step 2 of checkout: prove the payment is real, then tell everyone about it.

   Razorpay's browser popup hands back three values. Anyone can fake those in a
   console, so the only thing that counts is the HMAC: signature must equal
   HMAC-SHA256(order_id + "|" + payment_id) keyed with our secret. After that we
   re-read the order from Razorpay's own API rather than believing the browser
   about what was bought. */

const crypto = require('crypto');
const L = require('./_lib.js');

const RS = '₹';                                   // rupee sign

function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sameHex(a, b){
  const A = Buffer.from(String(a), 'utf8'), B = Buffer.from(String(b), 'utf8');
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

module.exports = async function handler(req, res){
  if (req.method !== 'POST') return L.json(res, 405, { error: 'Use POST.' });
  if (!L.LIVE)               return L.json(res, 503, { error: 'gateway_not_configured' });

  let b;
  try { b = await L.readBody(req); }
  catch (e) { return L.json(res, 400, { error: 'Could not read that response.' }); }

  const oid = String(b.razorpay_order_id   || '');
  const pid = String(b.razorpay_payment_id || '');
  const sig = String(b.razorpay_signature  || '');
  if (!oid || !pid || !sig) return L.json(res, 400, { error: 'Incomplete payment response.' });

  const expected = crypto.createHmac('sha256', L.KEY_SECRET).update(oid + '|' + pid).digest('hex');
  if (!sameHex(expected, sig)) {
    console.error('signature mismatch for', oid);
    return L.json(res, 400, { error: 'We could not verify that payment. Nothing has been charged twice - please contact us on WhatsApp.' });
  }

  // Authoritative copy of the order, straight from Razorpay.
  let order, payment;
  try {
    order   = await L.rzp('/orders/' + encodeURIComponent(oid));
    payment = await L.rzp('/payments/' + encodeURIComponent(pid));
  } catch (e) {
    console.error('razorpay read-back failed', e.status, e.payload);
    return L.json(res, 502, { error: 'Payment went through but we could not read it back. Please message us on WhatsApp with this ID: ' + pid });
  }

  const paid = payment.status === 'captured' || payment.status === 'authorized';
  const n    = order.notes || {};
  const amt  = (order.amount || 0) / 100;

  const summary = {
    receipt:  order.receipt || oid,
    paymentId: pid,
    orderId:  oid,
    amount:   amt,
    bottles:  Number(n.bottles || 0),
    items:    String(n.items || ''),
    method:   payment.method || '',
    status:   payment.status,
    customer: {
      name:  n.name || '', phone: n.phone || '', email: n.email || '',
      addr:  n.address || '', city: n.city || '', pin: n.pincode || ''
    }
  };

  if (!paid) return L.json(res, 402, { error: 'That payment did not complete.', summary: summary });

  const c = summary.customer;
  const addrBlock = [c.name, c.addr, c.city + ' - ' + c.pin, '+' + c.phone].join('\n');

  /* --- the order lands in Gauri's inbox --- */
  const adminText =
    'New paid order on getynot.in\n\n' +
    'Order   : ' + summary.receipt + '\n' +
    'Items   : ' + summary.items + '\n' +
    'Bottles : ' + summary.bottles + '\n' +
    'Paid    : ' + RS + amt.toLocaleString('en-IN') + ' (' + (summary.method || 'online') + ')\n' +
    'Payment : ' + pid + '\n\n' +
    'SHIP TO\n' + addrBlock + '\n' + c.email + '\n';

  const adminHtml =
    '<div style="font:15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#141018">' +
    '<p style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#FF2D87;margin:0 0 6px">New paid order</p>' +
    '<h2 style="margin:0 0 18px;font-size:24px">' + esc(summary.receipt) + '</h2>' +
    '<table cellpadding="0" cellspacing="0" style="font:15px/1.7 inherit">' +
    '<tr><td style="padding-right:18px;color:#6C6570">Items</td><td><b>' + esc(summary.items) + '</b></td></tr>' +
    '<tr><td style="padding-right:18px;color:#6C6570">Paid</td><td><b>' + RS + esc(amt.toLocaleString('en-IN')) + '</b> &middot; ' + esc(summary.method || 'online') + '</td></tr>' +
    '<tr><td style="padding-right:18px;color:#6C6570">Payment ID</td><td>' + esc(pid) + '</td></tr>' +
    '</table>' +
    '<h3 style="margin:24px 0 6px;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#6C6570">Ship to</h3>' +
    '<p style="margin:0;white-space:pre-line">' + esc(addrBlock) + '</p>' +
    '<p style="margin:6px 0 0"><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a> &middot; ' +
    '<a href="https://wa.me/' + esc(c.phone) + '">WhatsApp the buyer</a></p>' +
    '</div>';

  /* --- and a receipt goes to the buyer --- */
  const buyerText =
    'Thanks ' + c.name + '!\n\n' +
    'Your Ynot order is confirmed and paid.\n\n' +
    'Order   : ' + summary.receipt + '\n' +
    'Items   : ' + summary.items + '\n' +
    'Paid    : ' + RS + amt.toLocaleString('en-IN') + '\n\n' +
    'Delivering to\n' + addrBlock + '\n\n' +
    'WHAT HAPPENS NEXT\n' +
    'We have received your order and it is in the queue to be packed.\n' +
    'We will message you on WhatsApp with tracking details the moment it ships,\n' +
    'and keep you posted until it reaches you.\n\n' +
    'Questions? https://wa.me/' + L.BRAND_WA + '\n\n' +
    'Be you. Own it.\nYnot - getynot.in\n';

  const buyerHtml =
    '<div style="font:15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#141018;max-width:520px">' +
    '<p style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#FF2D87;margin:0 0 6px">Order confirmed</p>' +
    '<h2 style="margin:0 0 4px;font-size:26px">Thanks, ' + esc(c.name) + '.</h2>' +
    '<p style="margin:0 0 22px;color:#6C6570">Your Ynot order is paid and in the queue.</p>' +
    '<table cellpadding="0" cellspacing="0" style="font:15px/1.7 inherit;border-top:1px solid #EAE4EC;border-bottom:1px solid #EAE4EC;width:100%">' +
    '<tr><td style="padding:10px 0;color:#6C6570">Order</td><td style="text-align:right"><b>' + esc(summary.receipt) + '</b></td></tr>' +
    '<tr><td style="padding:10px 0;color:#6C6570;border-top:1px solid #F3EFF4">Items</td><td style="text-align:right;border-top:1px solid #F3EFF4">' + esc(summary.items) + '</td></tr>' +
    '<tr><td style="padding:10px 0;color:#6C6570;border-top:1px solid #F3EFF4">Paid</td><td style="text-align:right;border-top:1px solid #F3EFF4"><b>' + RS + esc(amt.toLocaleString('en-IN')) + '</b></td></tr>' +
    '</table>' +
    '<h3 style="margin:24px 0 6px;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#6C6570">Delivering to</h3>' +
    '<p style="margin:0;white-space:pre-line">' + esc(addrBlock) + '</p>' +
    '<h3 style="margin:24px 0 6px;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#6C6570">What happens next</h3>' +
    '<p style="margin:0;color:#6C6570">We have received your order and it is in the queue to be packed. ' +
    'We will message you on WhatsApp with tracking details the moment it ships, and keep you posted ' +
    'until it reaches you.</p>' +
    '<p style="margin:14px 0 0;color:#6C6570">Anything at all &mdash; ' +
    '<a href="https://wa.me/' + esc(L.BRAND_WA) + '" style="color:#FF2D87">message us here</a>.</p>' +
    '<p style="margin:26px 0 0;font-weight:700">Be you. Own it.</p>' +
    '<p style="margin:2px 0 0;color:#9A93A0;font-size:13px">Ynot &middot; getynot.in</p>' +
    '</div>';

  const mail = await Promise.all([
    L.sendMail(L.MAIL_TO, 'Order ' + summary.receipt + ' - ' + summary.items, adminText, adminHtml),
    c.email ? L.sendMail(c.email, 'Your Ynot order is confirmed (' + summary.receipt + ')', buyerText, buyerHtml)
            : Promise.resolve({ skipped: 'no_email' })
  ]);
  console.log('order', summary.receipt, 'mail', JSON.stringify(mail));

  return L.json(res, 200, { ok: true, summary: summary, wa: L.BRAND_WA });
};
