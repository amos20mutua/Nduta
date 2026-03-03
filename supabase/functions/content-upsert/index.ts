import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleOptions, json, parseJson } from "../_shared/response.ts";
import { isAllowedContentPath } from "../_shared/content.ts";
import { requireAdminKey } from "../_shared/admin-auth.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";

type Body = {
  path?: string;
  payload?: unknown;
};

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const authResponse = await requireAdminKey(req);
  if (authResponse) return authResponse;

  const body = await parseJson<Body>(req);
  if (!body) return json(400, { error: "Invalid JSON body" });

  const path = String(body.path || "").trim();
  if (!isAllowedContentPath(path)) return json(400, { error: "Invalid content path" });
  if (body.payload === undefined) return json(400, { error: "payload is required" });

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("site_content").upsert({
      path,
      payload: body.payload,
      updated_at: new Date().toISOString(),
    });
    if (error) return json(500, { error: "Failed to save content", detail: error.message });
    return json(200, { ok: true, path });
  } catch (error) {
    return json(500, { error: "Failed to save content", detail: (error as Error).message });
  }
});
