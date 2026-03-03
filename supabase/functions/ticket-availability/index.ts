import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleOptions, json } from "../_shared/response.ts";
import { loadEvents } from "../_shared/events.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== "GET") return json(405, { error: "Method not allowed" });

  try {
    const events = await loadEvents(req);
    const candidates = events
      .map((event) => ({
        eventId: String(event?.id || "").trim(),
        capacity: Math.max(0, Number(event?.ticketing?.capacity || 0)),
      }))
      .filter((item) => item.eventId);

    const supabase = getSupabaseAdmin();
    const items: Array<{ eventId: string; capacity: number; sold: number; remaining: number | null }> = [];

    for (const item of candidates) {
      if (item.capacity <= 0) {
        items.push({ eventId: item.eventId, capacity: 0, sold: 0, remaining: null });
        continue;
      }

      const { count } = await supabase
        .from("tickets")
        .select("id", { head: true, count: "exact" })
        .eq("event_id", item.eventId);

      const sold = Number(count || 0);
      items.push({
        eventId: item.eventId,
        capacity: item.capacity,
        sold,
        remaining: Math.max(0, item.capacity - sold),
      });
    }

    return json(200, { items });
  } catch (error) {
    return json(500, { error: "Failed to load availability", detail: (error as Error).message });
  }
});
