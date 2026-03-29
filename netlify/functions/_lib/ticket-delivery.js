const jwt = require('jsonwebtoken');

function getDownloadSecret() {
  const secret = process.env.TICKET_DOWNLOAD_SECRET || process.env.QR_JWT_SECRET || '';
  if (!secret) throw new Error('Missing TICKET_DOWNLOAD_SECRET or QR_JWT_SECRET');
  return secret;
}

function createDownloadToken(ticketId) {
  return jwt.sign(
    {
      ticket_id: ticketId,
      type: 'ticket_download'
    },
    getDownloadSecret(),
    {
      algorithm: 'HS256',
      expiresIn: '48h'
    }
  );
}

function verifyDownloadToken(token) {
  return jwt.verify(token, getDownloadSecret());
}

function getSiteBaseUrl(event) {
  const explicit = String(process.env.SITE_BASE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || '').trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const headers = event?.headers || {};
  const host = headers['x-forwarded-host'] || headers.host || '';
  const proto = headers['x-forwarded-proto'] || 'https';
  return host ? `${proto}://${host}` : '';
}

async function sendEmail(input) {
  const emailFrom = process.env.EMAIL_FROM || '';
  const resendKey = process.env.RESEND_API_KEY || '';
  const emailHost = process.env.EMAIL_HOST || '';
  const emailPort = process.env.EMAIL_PORT || '';
  const emailUser = process.env.EMAIL_USER || '';
  const emailPass = process.env.EMAIL_PASS || '';

  if (!input.holderEmail || !emailFrom) {
    return { sent: false, warning: 'Email skipped: recipient or EMAIL_FROM missing.' };
  }

  if (resendKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [input.holderEmail],
        subject: `Your ticket - ${input.eventTitle}`,
        html: `
          <p>Hi ${input.holderName},</p>
          <p>Your ticket is ready.</p>
          <p><strong>Event:</strong> ${input.eventTitle}<br/>
          <strong>Ticket ID:</strong> ${input.ticketId}<br/>
          <strong>Type:</strong> ${input.ticketType}<br/>
          <strong>Amount:</strong> ${input.amountLabel}</p>
          <p><a href="${input.downloadUrl}">Download ticket PDF</a></p>
          <p><a href="${input.verifyUrl}">Verify ticket</a></p>
        `
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      return { sent: false, warning: `Email send failed: ${detail}` };
    }

    return { sent: true };
  }

  if (emailHost && emailPort && emailUser && emailPass) {
    return { sent: false, warning: 'SMTP credentials detected. Configure RESEND_API_KEY for Netlify function email delivery.' };
  }

  return { sent: false, warning: 'Email not configured. Set RESEND_API_KEY and EMAIL_FROM.' };
}

async function sendWhatsapp(input) {
  const sid = process.env.TWILIO_ACCOUNT_SID || '';
  const token = process.env.TWILIO_AUTH_TOKEN || '';
  const from = process.env.TWILIO_WHATSAPP_FROM || '';
  const toPhone = String(input.phoneNumber || '').trim();

  if (!sid || !token || !from || !toPhone) {
    return { sent: false, warning: 'WhatsApp not configured. Skipped.' };
  }

  const to = toPhone.startsWith('whatsapp:') ? toPhone : `whatsapp:${toPhone}`;
  const body = [
    `Hello ${input.holderName}, your ticket is ready.`,
    `Event: ${input.eventTitle}`,
    `Ticket ID: ${input.ticketId}`,
    `Download: ${input.downloadUrl}`
  ].join('\n');

  const form = new URLSearchParams();
  form.set('From', from);
  form.set('To', to);
  form.set('Body', body);

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form.toString()
  });

  if (!response.ok) {
    const detail = await response.text();
    return { sent: false, warning: `WhatsApp send failed: ${detail}` };
  }

  return { sent: true };
}

async function deliverTicket(event, input) {
  const baseUrl = getSiteBaseUrl(event);
  const token = createDownloadToken(input.ticketId);
  const downloadUrl = `${baseUrl}/tickets-download?token=${encodeURIComponent(token)}`;
  const verifyUrl = `${baseUrl}/tickets-verify?ticketId=${encodeURIComponent(input.ticketId)}`;

  const email = await sendEmail({ ...input, downloadUrl, verifyUrl });
  const whatsapp = await sendWhatsapp({ ...input, downloadUrl, verifyUrl });
  return { email, whatsapp, downloadUrl, verifyUrl };
}

module.exports = {
  createDownloadToken,
  verifyDownloadToken,
  deliverTicket,
  getSiteBaseUrl
};
