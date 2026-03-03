const crypto = require('crypto');
const { json, parseJson } = require('./_lib/response');
const { getSupabaseAdmin } = require('./_lib/supabase');
const { verifySignedTicket } = require('./_lib/ticket-token');
const { rateLimit } = require('./_lib/rate-limit');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || 'unknown';
  const limit = Number(process.env.VALIDATE_RATE_LIMIT_MAX || 30);
  const windowMs = Number(process.env.VALIDATE_RATE_LIMIT_WINDOW_MS || 60000);
  const check = rateLimit(ip, limit, windowMs);
  if (check.blocked) return json(429, { error: 'Too many requests' });

  const body = parseJson(event);
  if (!body || !body.qrToken) return json(400, { error: 'qrToken is required' });

  let decoded;
  try {
    decoded = verifySignedTicket(body.qrToken);
  } catch {
    return json(401, { error: 'Invalid or expired QR token' });
  }

  const ticketId = decoded.ticket_id;
  const eventId = decoded.event_id;
  if (!ticketId || !eventId) return json(400, { error: 'Malformed ticket token' });

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('tickets')
    .update({ checked_in: true, checked_in_at: now, status: 'checked_in' })
    .eq('id', ticketId)
    .eq('event_id', eventId)
    .eq('checked_in', false)
    .select('id,event_id,holder_name,holder_email,checked_in,checked_in_at,status')
    .single();

  const scanLog = {
    id: crypto.randomUUID(),
    ticket_id: ticketId,
    event_id: eventId,
    scanned_at: now,
    scanner_ip: ip,
    outcome: error ? 'denied' : 'accepted'
  };
  await supabase.from('scan_logs').insert(scanLog);

  if (error || !data) {
    const { data: existing } = await supabase
      .from('tickets')
      .select('id,event_id,holder_name,holder_email,checked_in,checked_in_at,status')
      .eq('id', ticketId)
      .eq('event_id', eventId)
      .single();

    if (existing?.checked_in) {
      return json(409, { error: 'Ticket already checked in', ticket: existing });
    }

    return json(404, { error: 'Ticket not found or not valid for entry' });
  }

  return json(200, { ok: true, ticket: data });
};
