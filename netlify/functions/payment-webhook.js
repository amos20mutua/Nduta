const crypto = require('crypto');
const { json, parseJson } = require('./_lib/response');
const { issueTicket } = require('./_lib/ticket-service');

function verifyWebhookSignature(rawBody, signature, secret) {
  if (!secret) return true;
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const secret = process.env.PAYMENT_WEBHOOK_SECRET || '';
  const signature = event.headers['x-payment-signature'] || event.headers['x-webhook-signature'];
  if (!verifyWebhookSignature(event.body || '', signature, secret)) {
    return json(401, { error: 'Invalid webhook signature' });
  }

  const body = parseJson(event);
  if (!body) return json(400, { error: 'Invalid JSON body' });

  const { eventId, attendee, payment } = body;
  if (!eventId || !attendee?.name || !attendee?.email) {
    return json(400, { error: 'eventId and attendee fields are required' });
  }

  if (String(payment?.status || '').toLowerCase() !== 'success') {
    return json(200, { ok: true, issued: false, reason: 'payment_not_successful' });
  }

  try {
    const issued = await issueTicket({
      eventId,
      holderName: attendee.name,
      holderEmail: attendee.email,
      paymentStatus: 'paid',
      paymentReference: payment.reference || null,
      source: 'payment-webhook'
    });

    return json(200, {
      ok: true,
      issued: true,
      ticketId: issued.ticket.id,
      qrToken: issued.token,
      qrCodeDataUrl: issued.qrDataUrl
    });
  } catch (error) {
    return json(500, { error: 'Failed to issue paid ticket', detail: error.message });
  }
};
