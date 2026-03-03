import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleOptions, json } from "../_shared/response.ts";
import { getContent, isAllowedContentPath } from "../_shared/content.ts";

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== "GET") return json(405, { error: "Method not allowed" });

  const path = (new URL(req.url).searchParams.get("path") || "").trim();
  if (!isAllowedContentPath(path)) return json(400, { error: "Invalid content path" });

  try {
    const result = await getContent(path);
    if (!result.payload) return json(404, { error: "Content not found" });
    return json(
      200,
      { path, payload: result.payload, updatedAt: result.updatedAt, source: result.source },
      { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" },
    );
  } catch (error) {
    return json(500, { error: "Failed to load content", detail: (error as Error).message });
  }
});
