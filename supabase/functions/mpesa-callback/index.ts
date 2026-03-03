import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { json, parseJson, handleOptions } from "../_shared/response.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";
import { issueTicket } from "../_shared/ticket-service.ts";
import { deliverTicket } from "../_shared/ticket-delivery.ts";
import { loadEvents } from "../_shared/events.ts";

type CallbackItem = { Name?: string; Value?: string | number };
type CallbackBody = {
  Body?: {
    stkCallback?: {
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: { Item?: CallbackItem[] };
    };
  };
};

function metaValue(items: CallbackItem[] | undefined, name: string) {
  const match = (Array.isArray(items) ? items : []).find((item) => item?.Name === name);
  return match?.Value;
}

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const payload = await parseJson<CallbackBody>(req);
  if (!payload) return json(400, { error: "Invalid JSON body" });

  const callback = payload?.Body?.stkCallback;
  if (!callback?.CheckoutRequestID) return json(400, { error: "Invalid M-Pesa callback payload" });

  const checkoutRequestId = String(callback.CheckoutRequestID);
  const resultCode = Number(callback.ResultCode);
  const resultDesc = String(callback.ResultDesc || "");
  const metadataItems = callback?.CallbackMetadata?.Item || [];
  const mpesaReceipt = String(metaValue(metadataItems, "MpesaReceiptNumber") || "");

  const supabase = getSupabaseAdmin();
  const { data: intent, error: intentError } = await supabase
    .from("mpesa_intents")
    .select("*")
    .eq("checkout_request_id", checkoutRequestId)
    .maybeSingle();

  if (intentError) return json(500, { error: "Failed to load payment intent", detail: intentError.message });
  if (!intent) return json(404, { error: "Payment intent not found" });

  if (intent.status === "ticketed") return json(200, { ok: true, duplicate: true, issued: true });

  if (resultCode !== 0) {
    const { error: updateError } = await supabase
      .from("mpesa_intents")
      .update({ status: "failed", result_code: String(resultCode), result_desc: resultDesc })
      .eq("id", intent.id);
    if (updateError) return json(500, { error: "Failed to update failed payment intent", detail: updateError.message });
    return json(200, { ok: true, issued: false, reason: "payment_failed" });
  }

  const quantity = Math.max(1, Number(intent.quantity || 1));
  const issuedIds: string[] = [];
  const deliveryWarnings: string[] = [];
  const events = await loadEvents(req).catch(() => []);
  const eventTitle = events.find((e) => String(e?.id || "") === String(intent.event_id || ""))?.title || intent.event_id;
  const unitAmount = Math.max(0, Math.round(Number(intent.total_amount_ksh || 0) / quantity));
  for (let i = 0; i < quantity; i += 1) {
    const sequenceRef = quantity > 1 ? `${mpesaReceipt || checkoutRequestId}-${i + 1}` : (mpesaReceipt || checkoutRequestId);
    const ticket = await issueTicket({
      eventId: intent.event_id,
      holderName: intent.holder_name,
      holderEmail: intent.holder_email,
      paymentStatus: "paid",
      paymentReference: sequenceRef,
      source: "mpesa-callback",
    });
    issuedIds.push(ticket.ticket.id);

    const delivery = await deliverTicket({
      holderName: intent.holder_name,
      holderEmail: intent.holder_email,
      phoneNumber: intent.phone_number,
      eventTitle,
      ticketId: ticket.ticket.id,
      ticketType: intent.tier_name || "Paid Ticket",
      amountLabel: unitAmount > 0 ? `KSh ${unitAmount}` : "Paid",
    });
    if (delivery.email.warning) deliveryWarnings.push(delivery.email.warning);
    if (delivery.whatsapp.warning) deliveryWarnings.push(delivery.whatsapp.warning);
  }

  const { error: successUpdateError } = await supabase
    .from("mpesa_intents")
    .update({
      status: "ticketed",
      result_code: "0",
      result_desc: resultDesc,
      mpesa_receipt: mpesaReceipt || null,
      paid_at: new Date().toISOString(),
    })
    .eq("id", intent.id);

  if (successUpdateError) {
    return json(500, { error: "Tickets issued but failed to update intent state", detail: successUpdateError.message });
  }
  return json(200, { ok: true, issued: true, ticketCount: issuedIds.length, warnings: deliveryWarnings });
});
