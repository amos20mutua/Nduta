const { json, parseJson } = require('./_lib/response');
const { getSupabaseAdmin } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-auth');

const ALLOWED_STATUS = new Set(['new', 'contacted', 'closed']);

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, body: 'ok' };

  const authResponse = requireAdmin(event);
  if (authResponse) return authResponse;

  const supabase = getSupabaseAdmin();

  if (event.httpMethod === 'GET') {
    const status = String(event.queryStringParameters?.status || '').trim().toLowerCase();
    const limit = Math.min(200, Math.max(1, Number(event.queryStringParameters?.limit || 100)));

    let query = supabase
      .from('contact_inquiries')
      .select('id,name,email,phone,organization,event_date,location,message,status,source,created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (ALLOWED_STATUS.has(status)) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return json(500, { error: 'Failed to load inquiries', detail: error.message });
    return json(200, { items: data || [] });
  }

  if (event.httpMethod === 'POST') {
    const body = parseJson(event);
    if (!body) return json(400, { error: 'Invalid JSON body' });

    const id = String(body.id || '').trim();
    const status = String(body.status || '').trim().toLowerCase();
    if (!id || !ALLOWED_STATUS.has(status)) {
      return json(400, { error: 'Valid id and status are required' });
    }

    const { data, error } = await supabase
      .from('contact_inquiries')
      .update({ status })
      .eq('id', id)
      .select('id,status')
      .single();

    if (error) return json(500, { error: 'Failed to update inquiry', detail: error.message });
    return json(200, { ok: true, item: data });
  }

  return json(405, { error: 'Method not allowed' });
};
