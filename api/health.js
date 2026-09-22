/* Tells us, from the server's own point of view, whether order emails can go
   out - without ever returning a secret.

   Vercel's free plan keeps runtime logs for about an hour, so a failed send
   from yesterday leaves no trace. This endpoint answers the questions those
   logs would have: is the Resend key present and accepted, is the from-address
   well formed, and does Resend consider its domain verified.

   Safe to leave public: it reports booleans, domain names and status words.
   It never sends mail and never echoes a key. */

const L = require('./_lib.js');

function parseFrom(raw){
  const s = String(raw || '').trim();
  const out = { set: !!s, looks_valid: false, domain: null, issue: null };
  if (!s) { out.issue = 'ORDER_EMAIL_FROM is empty - falling back to the shared test address'; return out; }
  if (/^["']|["']$/.test(s)) out.issue = 'value is wrapped in quote marks - remove them in Vercel';
  const m = s.match(/<\s*([^<>\s]+@([^<>\s]+))\s*>\s*$/) || s.match(/^([^<>\s]+@([^<>\s]+))$/);
  if (!m) { out.issue = out.issue || 'not in the form  Ynot <orders@getynot.in>  or  orders@getynot.in'; return out; }
  out.domain = m[2].toLowerCase().replace(/["'>]+$/, '');
  out.looks_valid = !out.issue;
  return out;
}

function describeTo(raw){
  const s = String(raw == null ? '' : raw);
  const t = s.trim();
  const out = { set: !!t, looks_valid: false, masked: null, length: s.length, issue: null };
  if (!t) { out.issue = 'ORDER_EMAIL_TO is empty'; return out; }
  const at = t.indexOf('@');
  out.masked = at > 0 ? t.slice(0, 2) + '***' + t.slice(at) : t.slice(0, 3) + '*** (' + t.length + ' chars, no @)';
  if (s !== t)                     out.issue = 'has spaces or a line break before/after it';
  if (/^["']|["']$/.test(t))       out.issue = 'is wrapped in quote marks';
  else if (at < 0)                 out.issue = 'has no @ - it is not an email address';
  else if (/\s/.test(t))           out.issue = 'contains a space';
  else if (!/^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(t)) out.issue = 'is not a well-formed email address';
  out.looks_valid = !out.issue;
  return out;
}

module.exports = async function handler(req, res){
  const report = {
    checked_at: new Date().toISOString(),
    razorpay_live: L.LIVE,
    mail: {
      key_set: !!process.env.RESEND_API_KEY,
      to: describeTo(process.env.ORDER_EMAIL_TO),
      from: parseFrom(process.env.ORDER_EMAIL_FROM),
      resend: null
    }
  };

  const key = process.env.RESEND_API_KEY || '';
  if (key) {
    try {
      const r = await fetch((process.env.RESEND_API_BASE || 'https://api.resend.com') + '/domains', {
        headers: { 'Authorization': 'Bearer ' + key }
      });
      const text = await r.text();
      let body; try { body = JSON.parse(text); } catch (e) { body = {}; }
      if (r.ok) {
        const list = (body.data || []).map(d => ({ name: d.name, status: d.status, region: d.region }));
        const want = report.mail.from.domain;
        const hit = want && list.find(d => d.name === want || want.endsWith('.' + d.name));
        report.mail.resend = {
          key_accepted: true,
          domains: list,
          from_domain_status: hit ? hit.status : (want ? 'not added to Resend' : null)
        };
      } else if (body && body.name === 'restricted_api_key') {
        report.mail.resend = {
          key_accepted: true,
          sending_only: true,
          note: 'sending-only key: valid for sending, just not allowed to list domains - check verification in the Resend dashboard'
        };
      } else {
        report.mail.resend = {
          key_accepted: r.status !== 401 && r.status !== 403 ? null : false,
          http: r.status,
          // A sending-only key cannot list domains; that is fine and says nothing bad.
          note: (body && (body.name || body.message)) || text.slice(0, 160)
        };
      }
    } catch (e) {
      report.mail.resend = { error: String(e && e.message) };
    }
  }

  const m = report.mail, problems = [];
  if (!m.key_set) problems.push('RESEND_API_KEY is not set');
  if (m.to.issue) problems.push('ORDER_EMAIL_TO ' + m.to.issue + ' - ignored; order emails are going to the built-in address ' + L.MAIL_TO + ' until it is fixed');
  if (m.from.issue) problems.push('ORDER_EMAIL_FROM: ' + m.from.issue);
  if (m.resend && m.resend.from_domain_status && m.resend.from_domain_status !== 'verified')
    problems.push('Resend says ' + m.from.domain + ' is "' + m.resend.from_domain_status + '", not verified');
  if (m.resend && m.resend.key_accepted === false && m.resend.http === 401)
    problems.push('Resend rejected the API key (401) - it may have been deleted or mistyped');
  report.problems = problems;
  report.ok = problems.length === 0;

  L.json(res, 200, report);
};
