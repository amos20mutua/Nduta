const { json } = require('./_lib/response');
const { getContent, isAllowedContentPath } = require('./_lib/content');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, body: 'ok' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const contentPath = String(event.queryStringParameters?.path || '').trim();
  if (!isAllowedContentPath(contentPath)) return json(400, { error: 'Invalid content path' });

  try {
    const result = await getContent(contentPath);
    if (!result.payload) return json(404, { error: 'Content not found' });
    return json(200, {
      path: contentPath,
      payload: result.payload,
      updatedAt: result.updatedAt,
      source: result.source
    }, {
      'Cache-Control': 'no-store, max-age=0'
    });
  } catch (error) {
    return json(500, { error: 'Failed to load content', detail: error.message });
  }
};
