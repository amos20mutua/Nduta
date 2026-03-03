import { SignJWT, jwtVerify } from "npm:jose@5";
import QRCode from "npm:qrcode@1.5.4";

const textEncoder = new TextEncoder();

function getQrSecret() {
  const secret = Deno.env.get("QR_JWT_SECRET");
  if (!secret) throw new Error("Missing QR_JWT_SECRET");
  return secret;
}

export async function buildSignedTicket({ ticketId, eventId }: { ticketId: string; eventId: string }) {
  const secret = textEncoder.encode(getQrSecret());
  const token = await new SignJWT({
    ticket_id: ticketId,
    event_id: eventId,
    jti: crypto.randomUUID(),
    type: "ticket",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(secret);

  const tokenHashBuffer = await crypto.subtle.digest("SHA-256", textEncoder.encode(token));
  const tokenHash = Array.from(new Uint8Array(tokenHashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const qrDataUrl = await QRCode.toDataURL(token, { width: 360, margin: 1 });
  return { token, tokenHash, qrDataUrl };
}

export async function verifySignedTicket(token: string) {
  const secret = textEncoder.encode(getQrSecret());
  const { payload } = await jwtVerify(token, secret);
  return payload;
}
