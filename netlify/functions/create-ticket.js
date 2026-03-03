const { json, parseJson } = require('./_lib/response');
const { issueTicket } = require('./_lib/ticket-service');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const body = parseJson(event);
  if (!body) return json(400, { error: 'Invalid JSON body' });

  const { eventId, holderName, holderEmail, registrationType = 'free', paymentStatus = 'free', paymentReference } = body;
  if (!eventId || !holderName || !holderEmail) {
    return json(400, { error: 'eventId, holderName, holderEmail are required' });
  }

  const normalizedType = String(registrationType).toLowerCase();
  const normalizedPayment = String(paymentStatus).toLowerCase();

  if (normalizedType === 'paid' && normalizedPayment !== 'paid') {
    return json(402, { error: 'Payment required before ticket issuance' });
  }

  try {
    const result = await issueTicket({
      eventId,
      holderName,
      holderEmail,
      paymentStatus: normalizedPayment,
      paymentReference: paymentReference || null,
      source: 'create-ticket'
    });

    return json(200, {
      ticketId: result.ticket.id,
      eventId: result.ticket.event_id,
      qrToken: result.token,
      qrCodeDataUrl: result.qrDataUrl,
      status: result.ticket.status
    });
  } catch (error) {
    return json(500, { error: 'Failed to create ticket', detail: error.message });
  }
};
