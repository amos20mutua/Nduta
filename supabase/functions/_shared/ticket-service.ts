import { getSupabaseAdmin } from "./supabase.ts";
import { buildSignedTicket } from "./ticket-token.ts";

type IssueTicketInput = {
  eventId: string;
  holderName: string;
  holderEmail: string;
  paymentStatus?: string;
  paymentReference?: string | null;
  source?: string;
};

export async function issueTicket({
  eventId,
  holderName,
  holderEmail,
  paymentStatus = "free",
  paymentReference = null,
  source = "web",
}: IssueTicketInput) {
  const supabase = getSupabaseAdmin();
  const id = crypto.randomUUID();
  const { token, tokenHash, qrDataUrl } = await buildSignedTicket({ ticketId: id, eventId });

  const ticketPayload = {
    id,
    event_id: eventId,
    holder_name: holderName,
    holder_email: holderEmail,
    payment_status: paymentStatus,
    payment_reference: paymentReference,
    status: "issued",
    checked_in: false,
    token_hash: tokenHash,
    source,
    issued_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("tickets").insert(ticketPayload).select().single();
  if (error) throw error;

  return { ticket: data, token, qrDataUrl };
}
