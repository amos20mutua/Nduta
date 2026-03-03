import { getSupabaseAdmin } from "./supabase.ts";

const ALLOWED_PATHS = new Set([
  "/content/settings.json",
  "/content/homepage.json",
  "/content/events.json",
  "/content/music.json",
  "/content/media.json",
  "/content/theme.json",
]);

export function isAllowedContentPath(path: string) {
  return ALLOWED_PATHS.has(path);
}

export async function getContent(path: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("site_content").select("payload,updated_at").eq("path", path).maybeSingle();
  if (data?.payload) {
    return { payload: data.payload, updatedAt: data.updated_at || null, source: "db" as const };
  }

  const configuredBase = (Deno.env.get("CONTENT_BASE_URL") || "").replace(/\/$/, "");
  const requestBase = configuredBase || "";
  if (!requestBase) return { payload: null, updatedAt: null, source: "none" as const };

  const response = await fetch(`${requestBase}${path}`, { headers: { "Cache-Control": "no-cache" } });
  if (!response.ok) return { payload: null, updatedAt: null, source: "none" as const };
  const payload = await response.json();
  return { payload, updatedAt: null, source: "static" as const };
}
