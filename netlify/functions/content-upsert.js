const { json, parseJson } = require('./_lib/response');
const { isAllowedContentPath, upsertContent } = require('./_lib/content');
const { requireAdmin } = require('./_lib/admin-auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, body: 'ok' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const authResponse = requireAdmin(event);
  if (authResponse) return authResponse;

  const rawBody = String(event.body || '');
  if (Buffer.byteLength(rawBody, 'utf8') > 4.5 * 1024 * 1024) {
    return json(413, { error: 'Content payload is too large. Use smaller or compressed images and try again.' });
  }

  const body = parseJson(event);
  if (!body) return json(400, { error: 'Invalid JSON body' });

  const contentPath = String(body.path || '').trim();
  if (!isAllowedContentPath(contentPath)) return json(400, { error: 'Invalid content path' });
  if (body.payload === undefined) return json(400, { error: 'payload is required' });

  try {
    await upsertContent(contentPath, body.payload);
    return json(200, { ok: true, path: contentPath });
  } catch (error) {
    return json(500, { error: 'Failed to save content', detail: error.message });
  }
};
