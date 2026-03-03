import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleOptions, json } from "../_shared/response.ts";
import { requireAdminKey } from "../_shared/admin-auth.ts";

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== "GET") return json(405, { error: "Method not allowed" });

  const authResponse = await requireAdminKey(req);
  if (authResponse) return authResponse;

  return json(200, { ok: true });
});
