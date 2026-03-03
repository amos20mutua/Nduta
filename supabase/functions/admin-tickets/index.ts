import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { json, csv, handleOptions } from "../_shared/response.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";
import { requireAdminKey } from "../_shared/admin-auth.ts";

function toCsv(rows: Record<string, unknown>[]) {
  const headers = ["id", "event_id", "holder_name", "holder_email", "payment_status", "status", "checked_in", "issued_at", "checked_in_at"];
  const escape = (value: unknown) => {
    const s = String(value ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replaceAll('"', '""')}"`;
    }
    return s;
  };
  const lines = [headers.join(",")];
  rows.forEach((row) => lines.push(headers.map((h) => escape(row[h])).join(",")));
  return lines.join("\n");
}

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== "GET") return json(405, { error: "Method not allowed" });

  const authResponse = await requireAdminKey(req);
  if (authResponse) return authResponse;

  const url = new URL(req.url);
  const eventId = (url.searchParams.get("event_id") || "").trim();
  const format = (url.searchParams.get("format") || "").trim();

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("tickets")
    .select("id,event_id,holder_name,holder_email,payment_status,status,checked_in,issued_at,checked_in_at")
    .order("issued_at", { ascending: false });

  if (eventId) query = query.eq("event_id", eventId);

  const { data, error } = await query;
  if (error) return json(500, { error: "Failed to fetch tickets", detail: error.message });

  const { data: logs } = await supabase
    .from("scan_logs")
    .select("id,ticket_id,event_id,scanned_at,outcome,scanner_ip")
    .order("scanned_at", { ascending: false })
    .limit(500);

  if (format === "csv") return csv(200, toCsv((data || []) as Record<string, unknown>[]));
  return json(200, { tickets: data || [], scanLogs: logs || [] });
});
