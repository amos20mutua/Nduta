import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";
import { json, handleOptions } from "../_shared/response.ts";
import { verifyDownloadToken } from "../_shared/ticket-delivery.ts";
import { loadEvents } from "../_shared/events.ts";
import { buildTicketPdf } from "../_shared/ticket-pdf.ts";

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== "GET") return json(405, { error: "Method not allowed" });

  const token = (new URL(req.url).searchParams.get("token") || "").trim();
  if (!token) return json(400, { error: "Missing token" });

  let ticketId = "";
  try {
    const payload = await verifyDownloadToken(token);
    ticketId = String(payload.ticket_id || "").trim();
  } catch {
    return json(401, { error: "Invalid or expired download token" });
  }

  const supabase = getSupabaseAdmin();
  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("id,event_id,holder_name,payment_status")
    .eq("id", ticketId)
    .maybeSingle();
  if (error || !ticket) return json(404, { error: "Ticket not found" });

  let eventTitle = ticket.event_id;
  try {
    const events = await loadEvents(req);
    const match = events.find((e) => String(e?.id || "") === String(ticket.event_id || ""));
    if (match?.title) eventTitle = match.title;
  } catch {}

  const fnBase = `${new URL(req.url).origin}`;
  const verifyUrl = `${fnBase}/tickets-verify?ticketId=${encodeURIComponent(ticket.id)}`;
  const amountLabel = ticket.payment_status === "paid" ? "Paid" : "Free";
  const pdfBytes = await buildTicketPdf({
    ticketId: ticket.id,
    holderName: ticket.holder_name,
    eventTitle,
    ticketType: ticket.payment_status === "paid" ? "Paid Ticket" : "Free Ticket",
    amountLabel,
    verifyUrl,
  });

  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ticket-${ticket.id}.pdf"`,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
