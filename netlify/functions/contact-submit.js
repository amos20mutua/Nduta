const { json, parseJson } = require('./_lib/response');
const { getSupabaseAdmin } = require('./_lib/supabase');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function cleanText(value, max = 5000) {
  return String(value || '').trim().slice(0, max);
}

function normalizeDate(value) {
  const raw = cleanText(value, 32);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

async function notifyBookingOwner(inquiry) {
  const resendKey = String(process.env.RESEND_API_KEY || '').trim();
  const emailFrom = String(process.env.EMAIL_FROM || '').trim();
  const notifyEmail = String(process.env.BOOKING_NOTIFY_EMAIL || '').trim();
  if (!resendKey || !emailFrom || !notifyEmail) return { sent: false };

  const html = `
    <p>A new booking request was submitted on the website.</p>
    <p><strong>Name:</strong> ${inquiry.name}</p>
    <p><strong>Email:</strong> ${inquiry.email}</p>
    <p><strong>Phone:</strong> ${inquiry.phone || 'Not provided'}</p>
    <p><strong>Organization:</strong> ${inquiry.organization || 'Not provided'}</p>
    <p><strong>Event Date:</strong> ${inquiry.event_date || 'Not provided'}</p>
    <p><strong>Location:</strong> ${inquiry.location || 'Not provided'}</p>
    <p><strong>Message:</strong></p>
    <p>${inquiry.message.replace(/\n/g, '<br />')}</p>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [notifyEmail],
      subject: `New booking request from ${inquiry.name}`,
      html
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    return { sent: false, warning: detail || 'Notification email failed' };
  }

  return { sent: true };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, body: 'ok' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const body = parseJson(event);
  if (!body) return json(400, { error: 'Invalid JSON body' });

  if (cleanText(body.company, 255)) {
    return json(200, { ok: true, message: 'Booking request sent. You will receive a response soon.' });
  }

  const inquiry = {
    name: cleanText(body.name, 160),
    email: cleanText(body.email, 160).toLowerCase(),
    phone: cleanText(body.phone, 64) || null,
    organization: cleanText(body.organization, 160) || null,
    event_date: normalizeDate(body.eventDate),
    location: cleanText(body.location, 160) || null,
    message: cleanText(body.message, 5000),
    status: 'new',
    source: cleanText(body.source, 80) || 'website-contact-form'
  };

  if (!inquiry.name || !inquiry.email || !inquiry.message) {
    return json(400, { error: 'name, email, and message are required' });
  }
  if (!EMAIL_RE.test(inquiry.email)) {
    return json(400, { error: 'Use a valid email address' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('contact_inquiries')
      .insert(inquiry)
      .select('id')
      .single();

    if (error) throw error;

    const notification = await notifyBookingOwner(inquiry).catch((notifyError) => ({
      sent: false,
      warning: notifyError.message
    }));

    return json(200, {
      ok: true,
      inquiryId: data?.id || null,
      message: 'Booking request sent. You will receive a response soon.',
      notification
    });
  } catch (error) {
    return json(500, { error: 'Could not save booking request', detail: error.message });
  }
};
