import { SignJWT, jwtVerify } from "npm:jose@5";

const enc = new TextEncoder();

function getProjectRef() {
  const url = Deno.env.get("PROJECT_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
  const host = url.replace(/^https?:\/\//, "").split("/")[0];
  return host.split(".")[0] || "";
}

export function getFunctionsBaseUrl() {
  const explicit = (Deno.env.get("FUNCTIONS_BASE_URL") || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const ref = getProjectRef();
  return ref ? `https://${ref}.functions.supabase.co` : "";
}

export function getPublicBaseUrl() {
  return (Deno.env.get("CONTENT_BASE_URL") || "").trim().replace(/\/+$/, "");
}

function getDownloadSecret() {
  const secret = Deno.env.get("TICKET_DOWNLOAD_SECRET") || Deno.env.get("QR_JWT_SECRET") || "";
  if (!secret) throw new Error("Missing TICKET_DOWNLOAD_SECRET or QR_JWT_SECRET");
  return secret;
}

export async function createDownloadToken(ticketId: string) {
  return await new SignJWT({ ticket_id: ticketId, type: "ticket_download" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("48h")
    .sign(enc.encode(getDownloadSecret()));
}

export async function verifyDownloadToken(token: string) {
  const { payload } = await jwtVerify(token, enc.encode(getDownloadSecret()));
  return payload;
}

type NotifyInput = {
  holderName: string;
  holderEmail: string;
  phoneNumber?: string;
  eventTitle: string;
  ticketId: string;
  ticketType: string;
  amountLabel: string;
  downloadUrl: string;
  verifyUrl: string;
};

async function sendEmail(input: NotifyInput) {
  const emailFrom = Deno.env.get("EMAIL_FROM") || "";
  const resendKey = Deno.env.get("RESEND_API_KEY") || "";

  // Optional SMTP envs requested by project config.
  const emailHost = Deno.env.get("EMAIL_HOST") || "";
  const emailPort = Deno.env.get("EMAIL_PORT") || "";
  const emailUser = Deno.env.get("EMAIL_USER") || "";
  const emailPass = Deno.env.get("EMAIL_PASS") || "";

  if (!input.holderEmail || !emailFrom) {
    return { sent: false, warning: "Email skipped: recipient or EMAIL_FROM missing." };
  }

  if (resendKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
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
        `,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      return { sent: false, warning: `Email send failed: ${detail}` };
    }
    return { sent: true };
  }

  if (emailHost && emailPort && emailUser && emailPass) {
    return { sent: false, warning: "SMTP credentials detected. For Edge Functions, configure RESEND_API_KEY for email delivery." };
  }

  return { sent: false, warning: "Email not configured. Set RESEND_API_KEY and EMAIL_FROM." };
}

async function sendWhatsapp(input: NotifyInput) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
  const token = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  const from = Deno.env.get("TWILIO_WHATSAPP_FROM") || "";
  const toPhone = (input.phoneNumber || "").trim();

  if (!sid || !token || !from || !toPhone) {
    return { sent: false, warning: "WhatsApp not configured. Skipped." };
  }

  const to = toPhone.startsWith("whatsapp:") ? toPhone : `whatsapp:${toPhone}`;
  const body = [
    `Hello ${input.holderName}, your ticket is ready.`,
    `Event: ${input.eventTitle}`,
    `Ticket ID: ${input.ticketId}`,
    `Download: ${input.downloadUrl}`,
  ].join("\n");

  const form = new URLSearchParams();
  form.set("From", from);
  form.set("To", to);
  form.set("Body", body);

  const auth = btoa(`${sid}:${token}`);
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const detail = await response.text();
    return { sent: false, warning: `WhatsApp send failed: ${detail}` };
  }

  return { sent: true };
}

export async function deliverTicket(input: Omit<NotifyInput, "downloadUrl" | "verifyUrl">) {
  const token = await createDownloadToken(input.ticketId);
  const fnBase = getFunctionsBaseUrl();
  const downloadUrl = `${fnBase}/tickets-download?token=${encodeURIComponent(token)}`;
  const verifyUrl = `${fnBase}/tickets-verify?ticketId=${encodeURIComponent(input.ticketId)}`;

  const email = await sendEmail({ ...input, downloadUrl, verifyUrl });
  const whatsapp = await sendWhatsapp({ ...input, downloadUrl, verifyUrl });
  return { email, whatsapp, downloadUrl, verifyUrl };
}
