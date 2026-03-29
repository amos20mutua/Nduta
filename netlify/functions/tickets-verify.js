const { baseHeaders } = require('./_lib/response');
const { getSupabaseAdmin } = require('./_lib/supabase');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, body: 'ok' };
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...baseHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const ticketId = String(event.queryStringParameters?.ticketId || '').trim();
  if (!ticketId) {
    return {
      statusCode: 400,
      headers: { ...baseHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valid: false, error: 'ticketId is required' })
    };
  }

  const supabase = getSupabaseAdmin();
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id,event_id,holder_name,status,checked_in,issued_at')
    .eq('id', ticketId)
    .maybeSingle();

  const accept = event.headers?.accept || event.headers?.Accept || '';
  const wantsHtml = String(accept).includes('text/html');

  if (!ticket) {
    if (wantsHtml) {
      return {
        statusCode: 404,
        headers: { ...baseHeaders, 'Content-Type': 'text/html; charset=utf-8' },
        body: '<html><body style="font-family:Arial;padding:24px"><h2>Ticket Not Found</h2><p>This ticket ID is invalid.</p></body></html>'
      };
    }
    return {
      statusCode: 404,
      headers: { ...baseHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valid: false, error: 'Ticket not found' })
    };
  }

  const payload = {
    valid: true,
    ticket: {
      id: ticket.id,
      eventId: ticket.event_id,
      holderName: ticket.holder_name,
      status: ticket.status,
      checkedIn: ticket.checked_in,
      issuedAt: ticket.issued_at
    }
  };

  if (wantsHtml) {
    return {
      statusCode: 200,
      headers: { ...baseHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      body: `<html><body style="font-family:Arial;padding:24px;background:#fffaf5;color:#2d1a22">
        <h2>Ticket Verified</h2>
        <p><strong>Ticket ID:</strong> ${ticket.id}</p>
        <p><strong>Event:</strong> ${ticket.event_id}</p>
        <p><strong>Name:</strong> ${ticket.holder_name}</p>
        <p><strong>Status:</strong> ${ticket.status}</p>
        <p><strong>Checked in:</strong> ${ticket.checked_in ? 'Yes' : 'No'}</p>
      </body></html>`
    };
  }

  return {
    statusCode: 200,
    headers: { ...baseHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  };
};
