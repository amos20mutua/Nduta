import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";
import { handleOptions } from "../_shared/response.ts";

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const ticketId = (new URL(req.url).searchParams.get("ticketId") || "").trim();
  if (!ticketId) {
    return new Response(JSON.stringify({ valid: false, error: "ticketId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const supabase = getSupabaseAdmin();
  const { data: ticket } = await supabase
    .from("tickets")
    .select("id,event_id,holder_name,status,checked_in,issued_at")
    .eq("id", ticketId)
    .maybeSingle();

  const wantsHtml = (req.headers.get("accept") || "").includes("text/html");

  if (!ticket) {
    if (wantsHtml) {
      return new Response(
        `<html><body style="font-family:Arial;padding:24px"><h2>Ticket Not Found</h2><p>This ticket ID is invalid.</p></body></html>`,
        { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "Access-Control-Allow-Origin": "*" } },
      );
    }
    return new Response(JSON.stringify({ valid: false, error: "Ticket not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const payload = {
    valid: true,
    ticket: {
      id: ticket.id,
      eventId: ticket.event_id,
      holderName: ticket.holder_name,
      status: ticket.status,
      checkedIn: ticket.checked_in,
      issuedAt: ticket.issued_at,
    },
  };

  if (wantsHtml) {
    return new Response(
      `<html><body style="font-family:Arial;padding:24px;background:#fffaf5;color:#2d1a22">
        <h2>Ticket Verified</h2>
        <p><strong>Ticket ID:</strong> ${ticket.id}</p>
        <p><strong>Event:</strong> ${ticket.event_id}</p>
        <p><strong>Name:</strong> ${ticket.holder_name}</p>
        <p><strong>Status:</strong> ${ticket.status}</p>
        <p><strong>Checked in:</strong> ${ticket.checked_in ? "Yes" : "No"}</p>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Access-Control-Allow-Origin": "*" } },
    );
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
