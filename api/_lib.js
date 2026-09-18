/* Shared bits for the Ynot payment endpoints. No npm dependencies on purpose —
   Razorpay is reached over its plain REST API and signatures are checked with
   Node's own crypto, so this deploys on Vercel with nothing to install. */

const PRICE = 599;                                   // rupees, every scent, tax inclusive
const CATALOG = {
  black_bloom: 'Black Bloom',
  legacy:      'Legacy',
  dark_rogue:  'Dark Rogue',
  amour_belle: 'Amour Belle'
};
const MAX_QTY   = 9;                                 // per scent
const MAX_TOTAL = 24;                                // per order

const KEY_ID     = process.env.RAZORPAY_KEY_ID     || '';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const LIVE       = !!(KEY_ID && KEY_SECRET);
const TEST_MODE  = KEY_ID.indexOf('rzp_test') === 0;

const MAIL_KEY   = process.env.RESEND_API_KEY || '';
const MAIL_FROM  = process.env.ORDER_EMAIL_FROM || 'Ynot <onboarding@resend.dev>';
const MAIL_TO    = process.env.ORDER_EMAIL_TO   || 'gaurichhabra272012@gmail.com';
const BRAND_WA   = process.env.BRAND_WHATSAPP   || '919810868316';

function json(res, code, body){
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(code).send(JSON.stringify(body));
}

function readBody(req){
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise(function(resolve, reject){
    let raw = '';
    req.on('data', function(c){ raw += c; if (raw.length > 20000) req.destroy(); });
    req.on('end', function(){
      try { resolve(raw ? JSON.parse(raw) : {}); } catch(e){ reject(new Error('bad_json')); }
    });
    req.on('error', reject);
  });
}

/* Razorpay REST, authenticated with HTTP Basic. */
const RZP_BASE = process.env.RAZORPAY_API_BASE || 'https://api.razorpay.com/v1';

async function rzp(path, init){
  const auth = Buffer.from(KEY_ID + ':' + KEY_SECRET).toString('base64');
  const r = await fetch(RZP_BASE + path, Object.assign({
    headers: {
      'Authorization': 'Basic ' + auth,
      'Content-Type': 'application/json'
    }
  }, init || {}));
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch(e){ data = { raw: text }; }
  if (!r.ok) {
    const e = new Error((data.error && data.error.description) || 'razorpay_error');
    e.status = r.status; e.payload = data;
    throw e;
  }
  return data;
}

/* Turn whatever the browser sent into a trusted line-item list.
   Quantities are clamped and the price comes from here, never from the client. */
function priceCart(raw){
  const items = [];
  let count = 0;
  Object.keys(CATALOG).forEach(function(id){
    let q = parseInt(raw && raw[id], 10);
    if (!isFinite(q) || q <= 0) return;
    q = Math.min(MAX_QTY, q);
    count += q;
    items.push({ id: id, name: CATALOG[id], qty: q, price: PRICE, line: PRICE * q });
  });
  if (!items.length)     return { error: 'Your cart is empty.' };
  if (count > MAX_TOTAL) return { error: 'That is a lot of bottles - please message us on WhatsApp for bulk orders.' };
  const subtotal = items.reduce(function(a, b){ return a + b.line; }, 0);
  return { items: items, count: count, subtotal: subtotal, shipping: 0, total: subtotal };
}

function cleanCustomer(c){
  c = c || {};
  const strip = function(v, n){
    return String(v == null ? '' : v)
      .split('').filter(function(ch){ var n = ch.charCodeAt(0); return n > 31 && n !== 127; })
      .join('').replace(/\s+/g, ' ').trim().slice(0, n);
  };
  const out = {
    name:  strip(c.name, 80),
    phone: strip(c.phone, 20).replace(/[^\d+]/g, ''),
    email: strip(c.email, 120),
    addr:  strip(c.addr, 180),
    city:  strip(c.city, 60),
    pin:   strip(c.pin, 6).replace(/\D/g, '')
  };
  const bad = [];
  const digits = out.phone.replace(/\D/g, '');
  if (out.name.length < 2)                               bad.push('your name');
  if (digits.length < 10 || digits.length > 13)          bad.push('a valid mobile number');
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(out.email)) bad.push('a valid email');
  if (out.addr.length < 6)                               bad.push('your address');
  if (out.city.length < 2)                               bad.push('your city');
  if (!/^\d{6}$/.test(out.pin))                          bad.push('a 6-digit pincode');
  out.phone = digits.length === 10 ? '91' + digits : digits;
  return { c: out, bad: bad };
}

function itemLine(items){
  return items.map(function(i){ return i.name + ' x' + i.qty; }).join(', ');
}

function receiptNo(){
  return 'YNOT-' + Date.now().toString(36).toUpperCase().slice(-6) +
         '-' + Math.floor(Math.random() * 900 + 100);
}

async function sendMail(to, subject, text, html){
  if (!MAIL_KEY) return { skipped: 'no_mail_key' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + MAIL_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: MAIL_FROM, to: [to], subject: subject, text: text, html: html })
    });
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok: false, error: String(e && e.message) };
  }
}

module.exports = {
  PRICE, CATALOG, LIVE, TEST_MODE, KEY_ID, KEY_SECRET, MAIL_TO, BRAND_WA,
  json, readBody, rzp, priceCart, cleanCustomer, itemLine, receiptNo, sendMail
};
