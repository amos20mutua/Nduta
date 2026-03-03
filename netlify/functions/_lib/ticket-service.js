const crypto = require('crypto');
const { getSupabaseAdmin } = require('./supabase');
const { buildSignedTicket } = require('./ticket-token');

async function issueTicket({ eventId, holderName, holderEmail, paymentStatus = 'free', paymentReference = null, source = 'web' }) {
  const supabase = getSupabaseAdmin();
  const id = crypto.randomUUID();
  const { token, tokenHash, qrDataUrl } = await buildSignedTicket({ ticketId: id, eventId });

  const ticketPayload = {
    id,
    event_id: eventId,
    holder_name: holderName,
    holder_email: holderEmail,
    payment_status: paymentStatus,
    payment_reference: paymentReference,
    status: 'issued',
    checked_in: false,
    token_hash: tokenHash,
    source,
    issued_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from('tickets').insert(ticketPayload).select().single();
  if (error) throw error;

  return {
    ticket: data,
    token,
    qrDataUrl
  };
}

module.exports = { issueTicket };
