const { json } = require('./_lib/response');
const { requireAdmin } = require('./_lib/admin-auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, body: 'ok' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const authResponse = requireAdmin(event);
  if (authResponse) return authResponse;

  return json(200, { ok: true });
};
