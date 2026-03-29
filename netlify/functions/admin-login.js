const crypto = require('crypto');
const { json, parseJson } = require('./_lib/response');
const { createAdminSessionToken } = require('./_lib/admin-session');

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, body: 'ok' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const body = parseJson(event);
  if (!body) return json(400, { error: 'Invalid JSON body' });

  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!username || !password) {
    return json(400, { error: 'Username and password are required' });
  }

  const expectedUser = String(process.env.ADMIN_USERNAME || '').trim();
  const expectedPassword = String(process.env.ADMIN_PASSWORD || '');
  const secret = String(process.env.ADMIN_SESSION_SECRET || '');
  if (!expectedUser || !expectedPassword || !secret) {
    return json(503, { error: 'Admin login is not configured on server' });
  }

  if (!safeEqual(username, expectedUser) || !safeEqual(password, expectedPassword)) {
    return json(401, { error: 'Invalid username or password' });
  }

  const token = createAdminSessionToken(username, secret, 60 * 60 * 8);
  return json(200, { ok: true, token, expiresIn: 28800 });
};
