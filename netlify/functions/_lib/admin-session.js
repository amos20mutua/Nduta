const jwt = require('jsonwebtoken');

function createAdminSessionToken(username, secret, ttlSeconds = 60 * 60 * 8) {
  return jwt.sign(
    {
      sub: username,
      type: 'admin_session'
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: ttlSeconds
    }
  );
}

function verifyAdminSessionToken(token, secret) {
  try {
    const payload = jwt.verify(token, secret);
    if (!payload?.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = { createAdminSessionToken, verifyAdminSessionToken };
