const fs = require('fs/promises');
const path = require('path');
const { json, parseJson } = require('./_lib/response');
const { getSupabaseAdmin } = require('./_lib/supabase');

const KENYA_PHONE = /^2547\d{8}$/;

function normalizePhone(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('0')) return `254${digits.slice(1)}`;
  return digits;
}

function timestampNow() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ];
  return parts.join('');
}

async function loadEvents() {
  const file = path.resolve(process.cwd(), 'content/events.json');
  const raw = await fs.readFile(file, 'utf8');
  const payload = JSON.parse(raw);
  return Array.isArray(payload?.items) ? payload.items : [];
}

async function getDarajaToken(baseUrl, consumerKey, consumerSecret) {
  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: { Authorization: `Basic ${credentials}` }
  });
  if (!response.ok) throw new Error('Failed to authenticate with Daraja');
  const data = await response.json();
  if (!data.access_token) throw new Error('Daraja token missing in response');
  return data.access_token;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const body = parseJson(event);
  if (!body) return json(400, { error: 'Invalid JSON body' });

  const eventId = String(body.eventId || '').trim();
  const holderName = String(body.holderName || '').trim();
  const holderEmail = String(body.holderEmail || '').trim();
  const tierName = String(body.tierName || '').trim();
  const quantity = Number(body.quantity || 1);
  const phone = normalizePhone(body.phone);

  if (!eventId || !holderName || !holderEmail || !tierName) {
    return json(400, { error: 'eventId, holderName, holderEmail, and tierName are required' });
  }
  if (!Number.isFinite(quantity) || quantity < 1) return json(400, { error: 'Invalid quantity' });
  if (!KENYA_PHONE.test(phone)) return json(400, { error: 'Use a valid Safaricom phone number (07...).' });

  const mpesaEnabled = String(process.env.MPESA_ENABLED || 'true').toLowerCase() !== 'false';
  if (!mpesaEnabled) return json(503, { error: 'M-Pesa checkout is currently disabled' });

  let events;
  try {
    events = await loadEvents();
  } catch {
    return json(500, { error: 'Could not load events content' });
  }

  const selectedEvent = events.find((item) => String(item?.id || '').trim() === eventId);
  if (!selectedEvent) return json(404, { error: 'Event not found' });

  const eventDate = new Date(`${selectedEvent.date}T00:00:00`).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (Number.isNaN(eventDate) || eventDate < today) return json(400, { error: 'This event is no longer on sale' });
  if (String(selectedEvent.status || '').toLowerCase() !== 'available') return json(400, { error: 'This event is not available for ticket purchase' });
  if (selectedEvent?.buttons?.buyTicketEnabled === false) return json(400, { error: 'Ticket purchasing is disabled for this event' });

  const tiers = Array.isArray(selectedEvent.ticketTiers) ? selectedEvent.ticketTiers : [];
  const tier = tiers.find((item) => String(item?.name || '').trim() === tierName);
  if (!tier) return json(400, { error: 'Selected ticket tier is invalid' });

  const unitPriceKsh = Number(tier.priceKsh || 0);
  if (!Number.isFinite(unitPriceKsh) || unitPriceKsh <= 0) return json(400, { error: 'Ticket tier has invalid price' });

  const maxPerPurchase = Math.max(1, Number(selectedEvent?.ticketing?.maxPerPurchase || 1));
  if (quantity > maxPerPurchase) {
    return json(400, { error: `Maximum allowed per purchase is ${maxPerPurchase}` });
  }

  const capacity = Number(selectedEvent?.ticketing?.capacity || 0);
  const supabase = getSupabaseAdmin();
  if (capacity > 0) {
    const { count, error } = await supabase
      .from('tickets')
      .select('id', { head: true, count: 'exact' })
      .eq('event_id', eventId);
    if (error) return json(500, { error: 'Could not validate event capacity' });
    if ((count || 0) + quantity > capacity) return json(400, { error: 'Not enough ticket capacity remaining' });
  }

  const totalAmount = Math.round(unitPriceKsh * quantity);
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || '';
  const callbackUrl = process.env.MPESA_CALLBACK_URL || (siteUrl ? `${siteUrl.replace(/\/$/, '')}/mpesa-callback` : '');
  const baseUrl = process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.co.ke';

  if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackUrl) {
    return json(500, { error: 'Missing required M-Pesa environment variables' });
  }

  try {
    const token = await getDarajaToken(baseUrl, consumerKey, consumerSecret);
    const timestamp = timestampNow();
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const stkResponse = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: totalAmount,
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: selectedEvent.title || eventId,
        TransactionDesc: `${tierName} x${quantity} (${eventId})`
      })
    });

    const data = await stkResponse.json();
    if (!stkResponse.ok || String(data.ResponseCode || '') !== '0') {
      return json(400, { error: data.errorMessage || data.ResponseDescription || 'Daraja STK push failed' });
    }

    const intentPayload = {
      event_id: eventId,
      checkout_request_id: data.CheckoutRequestID || null,
      merchant_request_id: data.MerchantRequestID || null,
      holder_name: holderName,
      holder_email: holderEmail,
      phone_number: phone,
      tier_name: tierName,
      unit_price_ksh: unitPriceKsh,
      quantity,
      total_amount_ksh: totalAmount,
      status: 'initiated'
    };

    const { error: insertError } = await supabase.from('mpesa_intents').insert(intentPayload);
    if (insertError) {
      return json(500, { error: 'STK sent but failed to record payment intent', detail: insertError.message });
    }

    return json(200, {
      ok: true,
      message: data.ResponseDescription || 'Success. Request accepted for processing',
      customerMessage: data.CustomerMessage || 'STK Push sent. Confirm payment on your phone.',
      checkoutRequestId: data.CheckoutRequestID,
      merchantRequestId: data.MerchantRequestID,
      totalAmount
    });
  } catch (error) {
    return json(500, { error: 'Failed to initiate M-Pesa payment', detail: error.message });
  }
};
