const baseHeaders = {
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-admin-key, x-admin-session, x-payment-signature, x-webhook-signature',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...baseHeaders,
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

function csv(statusCode, body, filename = 'tickets.csv') {
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
      ...baseHeaders
    },
    body
  };
}

function parseJson(event) {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    return null;
  }
}

module.exports = { json, csv, parseJson, baseHeaders };
