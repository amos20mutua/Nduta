const crypto = require('crypto');
const { json } = require('./response');
const { verifyAdminSessionToken } = require('./admin-session');

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function getHeader(event, name) {
  const headers = event.headers || {};
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || '';
}

function getBearerToken(event) {
  const raw = getHeader(event, 'authorization');
  return String(raw || '').replace(/^Bearer\s+/i, '').trim();
}

function requireAdmin(event) {
  const sessionToken = getHeader(event, 'x-admin-session') || getBearerToken(event);
  const sessionSecret = String(process.env.ADMIN_SESSION_SECRET || '');
  if (sessionToken && sessionSecret) {
    const session = verifyAdminSessionToken(sessionToken, sessionSecret);
    if (session) return null;
  }

  const adminKey = String(process.env.ADMIN_API_KEY || '');
  if (adminKey) {
    const token = getHeader(event, 'x-admin-key');
    if (!token || !safeEqual(token, adminKey)) {
      return json(401, { error: 'Unauthorized' });
    }
    return null;
  }

  if (sessionSecret) {
    return json(401, { error: 'Unauthorized' });
  }

  return json(503, { error: 'Admin authentication is not configured on server' });
}

module.exports = { requireAdmin, getHeader };
