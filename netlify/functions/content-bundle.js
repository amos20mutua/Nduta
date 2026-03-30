const { json } = require('./_lib/response');
const { getContents, isAllowedContentPath } = require('./_lib/content');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, body: 'ok' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const rawPaths = String(event.queryStringParameters?.paths || '').trim();
  const requested = rawPaths
    .split(',')
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  if (!requested.length) return json(400, { error: 'No content paths provided' });
  if (requested.some((item) => !isAllowedContentPath(item))) {
    return json(400, { error: 'Invalid content path list' });
  }

  try {
    const items = await getContents(requested);
    return json(200, { items }, { 'Cache-Control': 'no-store, max-age=0' });
  } catch (error) {
    return json(500, { error: 'Failed to load content bundle', detail: error.message });
  }
};
