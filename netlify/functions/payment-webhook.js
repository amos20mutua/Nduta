const crypto = require('crypto');
const { json, parseJson } = require('./_lib/response');
const { issueTicket } = require('./_lib/ticket-service');
const { deliverTicket } = require('./_lib/ticket-delivery');
const { loadEvents } = require('./_lib/events');

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
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, body: 'ok' };
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

    const events = await loadEvents().catch(() => []);
    const eventTitle = events.find((item) => String(item?.id || '') === String(eventId || ''))?.title || eventId;
    const delivery = await deliverTicket(event, {
      holderName: attendee.name,
      holderEmail: attendee.email,
      phoneNumber: attendee.phone,
      eventTitle,
      ticketId: issued.ticket.id,
      ticketType: 'Paid Ticket',
      amountLabel: Number(payment?.amountKsh || 0) > 0 ? `KSh ${Number(payment.amountKsh)}` : 'Paid'
    });

    return json(200, {
      ok: true,
      issued: true,
      ticketId: issued.ticket.id,
      qrToken: issued.token,
      qrCodeDataUrl: issued.qrDataUrl,
      delivery
    });
  } catch (error) {
    return json(500, { error: 'Failed to issue paid ticket', detail: error.message });
  }
};
