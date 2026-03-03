type DarajaConfig = {
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  shortcode: string;
  callbackUrl: string;
  baseUrl: string;
};

function pick(nameA: string, nameB: string) {
  return (Deno.env.get(nameA) || Deno.env.get(nameB) || "").trim();
}

export function getDarajaConfig(): { ok: true; config: DarajaConfig } | { ok: false; error: string } {
  const consumerKey = pick("DARAJA_CONSUMER_KEY", "MPESA_CONSUMER_KEY");
  const consumerSecret = pick("DARAJA_CONSUMER_SECRET", "MPESA_CONSUMER_SECRET");
  const passkey = pick("DARAJA_PASSKEY", "MPESA_PASSKEY");
  const shortcode = pick("DARAJA_SHORTCODE", "MPESA_SHORTCODE");
  const callbackUrl = pick("DARAJA_CALLBACK_URL", "MPESA_CALLBACK_URL");
  const baseUrl = pick("DARAJA_BASE_URL", "MPESA_BASE_URL") || "https://sandbox.safaricom.co.ke";

  if (!consumerKey || !consumerSecret || !passkey || !shortcode || !callbackUrl) {
    return { ok: false, error: "Payment temporarily unavailable. Try again later." };
  }

  return {
    ok: true,
    config: {
      consumerKey,
      consumerSecret,
      passkey,
      shortcode,
      callbackUrl,
      baseUrl,
    },
  };
}
