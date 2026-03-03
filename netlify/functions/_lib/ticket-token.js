const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');

function getQrSecret() {
  const secret = process.env.QR_JWT_SECRET;
  if (!secret) throw new Error('Missing QR_JWT_SECRET');
  return secret;
}

async function buildSignedTicket({ ticketId, eventId }) {
  const token = jwt.sign(
    {
      ticket_id: ticketId,
      event_id: eventId,
      jti: crypto.randomUUID(),
      type: 'ticket'
    },
    getQrSecret(),
    { expiresIn: '365d' }
  );

  const qrDataUrl = await QRCode.toDataURL(token, { width: 360, margin: 1 });
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  return { token, tokenHash, qrDataUrl };
}

function verifySignedTicket(token) {
  return jwt.verify(token, getQrSecret());
}

module.exports = { buildSignedTicket, verifySignedTicket };
