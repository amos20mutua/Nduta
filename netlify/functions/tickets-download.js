const { json, baseHeaders } = require('./_lib/response');
const { getSupabaseAdmin } = require('./_lib/supabase');
const { verifyDownloadToken, getSiteBaseUrl } = require('./_lib/ticket-delivery');
const { loadEvents } = require('./_lib/events');
const { buildTicketPdf } = require('./_lib/ticket-pdf');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, body: 'ok' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const token = String(event.queryStringParameters?.token || '').trim();
  if (!token) return json(400, { error: 'Missing token' });

  let ticketId = '';
  try {
    const payload = verifyDownloadToken(token);
    ticketId = String(payload.ticket_id || '').trim();
  } catch {
    return json(401, { error: 'Invalid or expired download token' });
  }

  const supabase = getSupabaseAdmin();
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('id,event_id,holder_name,payment_status')
    .eq('id', ticketId)
    .maybeSingle();

  if (error || !ticket) return json(404, { error: 'Ticket not found' });

  let eventTitle = ticket.event_id;
  try {
    const events = await loadEvents();
    const match = events.find((item) => String(item?.id || '') === String(ticket.event_id || ''));
    if (match?.title) eventTitle = match.title;
  } catch {}

  const baseUrl = getSiteBaseUrl(event);
  const verifyUrl = `${baseUrl}/tickets-verify?ticketId=${encodeURIComponent(ticket.id)}`;
  const amountLabel = ticket.payment_status === 'paid' ? 'Paid' : 'Free';
  const pdfBytes = await buildTicketPdf({
    ticketId: ticket.id,
    holderName: ticket.holder_name,
    eventTitle,
    ticketType: ticket.payment_status === 'paid' ? 'Paid Ticket' : 'Free Ticket',
    amountLabel,
    verifyUrl
  });

  return {
    statusCode: 200,
    isBase64Encoded: true,
    headers: {
      ...baseHeaders,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ticket-${ticket.id}.pdf"`
    },
    body: Buffer.from(pdfBytes).toString('base64')
  };
};
