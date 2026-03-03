import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { json, parseJson, handleOptions } from "../_shared/response.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";
import { loadEvents, type EventRecord } from "../_shared/events.ts";
import { getDarajaConfig } from "../_shared/daraja-config.ts";

const KENYA_PHONE = /^2547\d{8}$/;

type StkBody = {
  eventId?: string;
  holderName?: string;
  holderEmail?: string;
  phone?: string;
  tierName?: string;
  quantity?: number;
};

function normalizePhone(input: string) {
  const digits = String(input || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  return digits;
}

function timestampNow() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
}

async function getDarajaToken(baseUrl: string, consumerKey: string, consumerSecret: string) {
  const credentials = btoa(`${consumerKey}:${consumerSecret}`);
  const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    method: "GET",
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!response.ok) throw new Error("Failed to authenticate with Daraja");
  const data = await response.json();
  if (!data.access_token) throw new Error("Daraja token missing in response");
  return data.access_token as string;
}

function findEvent(events: EventRecord[], eventId: string) {
  return events.find((item) => String(item?.id || "").trim() === eventId);
}

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const body = await parseJson<StkBody>(req);
  if (!body) return json(400, { error: "Invalid JSON body" });

  const eventId = String(body.eventId || "").trim();
  const holderName = String(body.holderName || "").trim();
  const holderEmail = String(body.holderEmail || "").trim();
  const tierName = String(body.tierName || "").trim();
  const quantity = Number(body.quantity || 1);
  const phone = normalizePhone(String(body.phone || ""));

  if (!eventId || !holderName || !holderEmail || !tierName) {
    return json(400, { error: "eventId, holderName, holderEmail, and tierName are required" });
  }
  if (!Number.isFinite(quantity) || quantity < 1) return json(400, { error: "Invalid quantity" });
  if (!KENYA_PHONE.test(phone)) return json(400, { error: "Use a valid Safaricom phone number (07...)." });

  const mpesaEnabled = String(Deno.env.get("MPESA_ENABLED") || "true").toLowerCase() !== "false";
  if (!mpesaEnabled) return json(503, { error: "M-Pesa checkout is currently disabled" });

  let events: EventRecord[] = [];
  try {
    events = await loadEvents(req);
  } catch (error) {
    return json(500, { error: "Could not load events content", detail: (error as Error).message });
  }

  const selectedEvent = findEvent(events, eventId);
  if (!selectedEvent) return json(404, { error: "Event not found" });

  const eventDate = new Date(`${selectedEvent.date}T00:00:00`).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (Number.isNaN(eventDate) || eventDate < today) return json(400, { error: "This event is no longer on sale" });
  if (String(selectedEvent.status || "").toLowerCase() !== "available") return json(400, { error: "This event is not available for ticket purchase" });
  if (selectedEvent?.buttons?.buyTicketEnabled === false) return json(400, { error: "Ticket purchasing is disabled for this event" });

  const tiers = Array.isArray(selectedEvent.ticketTiers) ? selectedEvent.ticketTiers : [];
  const tier = tiers.find((item) => String(item?.name || "").trim() === tierName);
  if (!tier) return json(400, { error: "Selected ticket tier is invalid" });

  const unitPriceKsh = Number(tier.priceKsh || 0);
  if (!Number.isFinite(unitPriceKsh) || unitPriceKsh <= 0) return json(400, { error: "Ticket tier has invalid price" });

  const maxPerPurchase = Math.max(1, Number(selectedEvent?.ticketing?.maxPerPurchase || 1));
  if (quantity > maxPerPurchase) return json(400, { error: `Maximum allowed per purchase is ${maxPerPurchase}` });

  const capacity = Number(selectedEvent?.ticketing?.capacity || 0);
  const supabase = getSupabaseAdmin();
  if (capacity > 0) {
    const { count, error } = await supabase.from("tickets").select("id", { head: true, count: "exact" }).eq("event_id", eventId);
    if (error) return json(500, { error: "Could not validate event capacity" });
    if ((count || 0) + quantity > capacity) return json(400, { error: "Not enough ticket capacity remaining" });
  }

  const totalAmount = Math.round(unitPriceKsh * quantity);
  const daraja = getDarajaConfig();
  if (!daraja.ok) return json(503, { error: daraja.error });
  const { consumerKey, consumerSecret, shortcode, passkey, callbackUrl, baseUrl } = daraja.config;

  try {
    const token = await getDarajaToken(baseUrl, consumerKey, consumerSecret);
    const timestamp = timestampNow();
    const password = btoa(`${shortcode}${passkey}${timestamp}`);
    const stkResponse = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: totalAmount,
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: selectedEvent.title || eventId,
        TransactionDesc: `${tierName} x${quantity} (${eventId})`,
      }),
    });
    const data = await stkResponse.json();
    if (!stkResponse.ok || String(data.ResponseCode || "") !== "0") {
      return json(400, { error: data.errorMessage || data.ResponseDescription || "Daraja STK push failed" });
    }

    const { error: insertError } = await supabase.from("mpesa_intents").insert({
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
      status: "initiated",
    });
    if (insertError) {
      return json(500, { error: "STK sent but failed to record payment intent", detail: insertError.message });
    }

    return json(200, {
      ok: true,
      message: data.ResponseDescription || "Success. Request accepted for processing",
      customerMessage: data.CustomerMessage || "STK Push sent. Confirm payment on your phone.",
      checkoutRequestId: data.CheckoutRequestID,
      merchantRequestId: data.MerchantRequestID,
      totalAmount,
    });
  } catch (error) {
    return json(500, { error: "Failed to initiate M-Pesa payment", detail: (error as Error).message });
  }
});
