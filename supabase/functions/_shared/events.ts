import { getSupabaseAdmin } from "./supabase.ts";

export type EventRecord = {
  id?: string;
  title?: string;
  date?: string;
  status?: string;
  buttons?: { buyTicketEnabled?: boolean };
  ticketTiers?: Array<{ name?: string; priceKsh?: number }>;
  ticketing?: { maxPerPurchase?: number; capacity?: number };
};

export async function loadEvents(req: Request): Promise<EventRecord[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from("site_content").select("payload").eq("path", "/content/events.json").maybeSingle();
    if (data?.payload) {
      return Array.isArray(data.payload?.items) ? data.payload.items : [];
    }
  } catch {
    // Continue to static fallback.
  }

  const configuredBase = (Deno.env.get("CONTENT_BASE_URL") || "").replace(/\/$/, "");
  const requestBase = new URL(req.url).origin;
  const base = configuredBase || requestBase;
  const response = await fetch(`${base}/content/events.json`, { headers: { "Cache-Control": "no-cache" } });
  if (!response.ok) throw new Error("Could not load events content");
  const payload = await response.json();
  return Array.isArray(payload?.items) ? payload.items : [];
}
