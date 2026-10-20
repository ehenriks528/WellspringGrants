const crypto = require('node:crypto');
const {normalizeLabel}=require('../public/source-attribution');
function text(value, max = 2000) {
  if (typeof value !== 'string' || value.length > max) throw new Error('Please check the form fields.');
  return value.trim();
}
function email(value) {
  const result = text(value, 254).toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(result)) throw new Error('Enter a valid email address.');
  return result;
}
function url(value) {
  if (!value) return '';
  const result = new URL(text(value, 2048));
  if (result.protocol !== 'https:' || result.username || result.password) throw new Error('Use an HTTPS website address.');
  return result.href;
}
function date(value) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value).toISOString().slice(0,10) !== value) throw new Error('Enter a valid deadline.');
  return value;
}
function lead(body) {
  if (body.consent !== true && body.consent !== 'on') throw new Error('Please agree to receive a reply about your inquiry.');
  const result = {
    org_name: text(body.org_name, 160), contact_name: text(body.contact_name, 120),
    email: email(body.email), website: url(body.website), location: text(body.location, 160),
    project: text(body.project, 3000), grant_url: url(body.grant_url), deadline: date(body.deadline),
    source: normalizeLabel(body.source)
  };
  if (!result.org_name || !result.contact_name || !result.location || result.project.length < 20) throw new Error('Add your organization, name, location, and a short project description (at least 20 characters).');
  return result;
}
function escape(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function signLead(id, secret) { return `${id}.${crypto.createHmac('sha256', secret).update(id).digest('hex')}`; }
function readLead(req, secret) {
  const cookie = (req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith('ws_lead='));
  if (!cookie || !secret) return null;
  const token = cookie.slice(8), id = token.split('.')[0];
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const expected = signLead(id, secret);
  return token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected)) ? id : null;
}
module.exports = {text, email, url, date, lead, escape, signLead, readLead};
