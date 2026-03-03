import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { json, parseJson, handleOptions } from "../_shared/response.ts";
import { issueTicket } from "../_shared/ticket-service.ts";
import { deliverTicket } from "../_shared/ticket-delivery.ts";
import { loadEvents } from "../_shared/events.ts";

type PaymentBody = {
  eventId?: string;
  attendee?: { name?: string; email?: string; phone?: string };
  payment?: { status?: string; reference?: string; amountKsh?: number };
};

async function verifyWebhookSignature(rawBody: string, signature: string, secret: string) {
  if (!secret) return true;
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === signature;
}

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const rawBody = await req.text();
  const secret = Deno.env.get("PAYMENT_WEBHOOK_SECRET") || "";
  const signature = req.headers.get("x-payment-signature") || req.headers.get("x-webhook-signature") || "";
  const isValidSignature = await verifyWebhookSignature(rawBody, signature, secret);
  if (!isValidSignature) return json(401, { error: "Invalid webhook signature" });

  let body: PaymentBody | null = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    body = null;
  }
  if (!body) return json(400, { error: "Invalid JSON body" });

  const eventId = String(body.eventId || "").trim();
  const attendeeName = String(body.attendee?.name || "").trim();
  const attendeeEmail = String(body.attendee?.email || "").trim();
  const attendeePhone = String(body.attendee?.phone || "").trim();
  const paymentStatus = String(body.payment?.status || "").toLowerCase();

  if (!eventId || !attendeeName || !attendeeEmail) {
    return json(400, { error: "eventId and attendee fields are required" });
  }

  if (paymentStatus !== "success") {
    return json(200, { ok: true, issued: false, reason: "payment_not_successful" });
  }

  try {
    const issued = await issueTicket({
      eventId,
      holderName: attendeeName,
      holderEmail: attendeeEmail,
      paymentStatus: "paid",
      paymentReference: body.payment?.reference || null,
      source: "payment-webhook",
    });

    const events = await loadEvents(req).catch(() => []);
    const eventTitle = events.find((e) => String(e?.id || "") === eventId)?.title || eventId;
    const delivery = await deliverTicket({
      holderName: attendeeName,
      holderEmail: attendeeEmail,
      phoneNumber: attendeePhone,
      eventTitle,
      ticketId: issued.ticket.id,
      ticketType: "Paid Ticket",
      amountLabel: Number(body.payment?.amountKsh || 0) > 0 ? `KSh ${Number(body.payment?.amountKsh)}` : "Paid",
    });

    return json(200, {
      ok: true,
      issued: true,
      ticketId: issued.ticket.id,
      qrToken: issued.token,
      qrCodeDataUrl: issued.qrDataUrl,
      delivery,
    });
  } catch (error) {
    return json(500, { error: "Failed to issue paid ticket", detail: (error as Error).message });
  }
});
