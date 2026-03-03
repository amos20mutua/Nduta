import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { json, parseJson, handleOptions } from "../_shared/response.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";
import { verifySignedTicket } from "../_shared/ticket-token.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { requireAdminKey } from "../_shared/admin-auth.ts";

type ValidateBody = { qrToken?: string };

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const authResponse = await requireAdminKey(req);
  if (authResponse) return authResponse;

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  const limit = Number(Deno.env.get("VALIDATE_RATE_LIMIT_MAX") || 30);
  const windowMs = Number(Deno.env.get("VALIDATE_RATE_LIMIT_WINDOW_MS") || 60000);
  const check = rateLimit(ip, limit, windowMs);
  if (check.blocked) return json(429, { error: "Too many requests" });

  const body = await parseJson<ValidateBody>(req);
  if (!body || !body.qrToken) return json(400, { error: "qrToken is required" });

  let decoded: Record<string, unknown>;
  try {
    decoded = await verifySignedTicket(body.qrToken);
  } catch {
    return json(401, { error: "Invalid or expired QR token" });
  }

  const ticketId = String(decoded.ticket_id || "").trim();
  const eventId = String(decoded.event_id || "").trim();
  if (!ticketId || !eventId) return json(400, { error: "Malformed ticket token" });

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("tickets")
    .update({ checked_in: true, checked_in_at: now, status: "checked_in" })
    .eq("id", ticketId)
    .eq("event_id", eventId)
    .eq("checked_in", false)
    .select("id,event_id,holder_name,holder_email,checked_in,checked_in_at,status")
    .single();

  await supabase.from("scan_logs").insert({
    id: crypto.randomUUID(),
    ticket_id: ticketId,
    event_id: eventId,
    scanned_at: now,
    scanner_ip: ip,
    outcome: error ? "denied" : "accepted",
  });

  if (error || !data) {
    const { data: existing } = await supabase
      .from("tickets")
      .select("id,event_id,holder_name,holder_email,checked_in,checked_in_at,status")
      .eq("id", ticketId)
      .eq("event_id", eventId)
      .single();

    if (existing?.checked_in) {
      return json(409, { error: "Ticket already checked in", ticket: existing });
    }
    return json(404, { error: "Ticket not found or not valid for entry" });
  }

  return json(200, { ok: true, ticket: data });
});
