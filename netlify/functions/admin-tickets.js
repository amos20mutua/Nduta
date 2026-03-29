const { json, csv } = require('./_lib/response');
const { getSupabaseAdmin } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-auth');

function toCsv(rows) {
  const headers = ['id', 'event_id', 'holder_name', 'holder_email', 'payment_status', 'status', 'checked_in', 'issued_at', 'checked_in_at'];
  const escape = (value) => {
    const s = String(value ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replaceAll('"', '""') + '"';
    }
    return s;
  };
  const lines = [headers.join(',')];
  rows.forEach((row) => lines.push(headers.map((h) => escape(row[h])).join(',')));
  return lines.join('\n');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, body: 'ok' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const authResponse = requireAdmin(event);
  if (authResponse) return authResponse;

  const eventId = event.queryStringParameters?.event_id;
  const format = event.queryStringParameters?.format;

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('tickets')
    .select('id,event_id,holder_name,holder_email,payment_status,status,checked_in,issued_at,checked_in_at')
    .order('issued_at', { ascending: false });

  if (eventId) query = query.eq('event_id', eventId);

  const { data, error } = await query;
  if (error) return json(500, { error: 'Failed to fetch tickets', detail: error.message });

  const { data: logs } = await supabase
    .from('scan_logs')
    .select('id,ticket_id,event_id,scanned_at,outcome,scanner_ip')
    .order('scanned_at', { ascending: false })
    .limit(500);

  if (format === 'csv') return csv(200, toCsv(data || []));

  return json(200, { tickets: data || [], scanLogs: logs || [] });
};
