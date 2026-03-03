import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { json, parseJson, handleOptions } from "../_shared/response.ts";
import { issueTicket } from "../_shared/ticket-service.ts";

type CreateTicketBody = {
  eventId?: string;
  holderName?: string;
  holderEmail?: string;
  registrationType?: string;
  paymentStatus?: string;
  paymentReference?: string;
};

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const body = await parseJson<CreateTicketBody>(req);
  if (!body) return json(400, { error: "Invalid JSON body" });

  const eventId = String(body.eventId || "").trim();
  const holderName = String(body.holderName || "").trim();
  const holderEmail = String(body.holderEmail || "").trim();
  const registrationType = String(body.registrationType || "free").toLowerCase();
  const paymentStatus = String(body.paymentStatus || "free").toLowerCase();

  if (!eventId || !holderName || !holderEmail) {
    return json(400, { error: "eventId, holderName, holderEmail are required" });
  }
  if (registrationType === "paid" && paymentStatus !== "paid") {
    return json(402, { error: "Payment required before ticket issuance" });
  }

  try {
    const result = await issueTicket({
      eventId,
      holderName,
      holderEmail,
      paymentStatus,
      paymentReference: body.paymentReference || null,
      source: "create-ticket",
    });
    return json(200, {
      ticketId: result.ticket.id,
      eventId: result.ticket.event_id,
      qrToken: result.token,
      qrCodeDataUrl: result.qrDataUrl,
      status: result.ticket.status,
    });
  } catch (error) {
    return json(500, { error: "Failed to create ticket", detail: (error as Error).message });
  }
});
