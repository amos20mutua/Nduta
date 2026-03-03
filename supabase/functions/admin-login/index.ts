import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleOptions, json, parseJson } from "../_shared/response.ts";
import { createAdminSessionToken } from "../_shared/admin-session.ts";

type LoginBody = {
  username?: string;
  password?: string;
};

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const body = await parseJson<LoginBody>(req);
  if (!body) return json(400, { error: "Invalid JSON body" });

  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  if (!username || !password) return json(400, { error: "Username and password are required" });

  const expectedUser = String(Deno.env.get("ADMIN_USERNAME") || "").trim();
  const expectedPassword = String(Deno.env.get("ADMIN_PASSWORD") || "");
  const secret = String(Deno.env.get("ADMIN_SESSION_SECRET") || "");
  if (!expectedUser || !expectedPassword || !secret) {
    return json(503, { error: "Admin login is not configured on server" });
  }

  if (!safeEqual(username, expectedUser) || !safeEqual(password, expectedPassword)) {
    return json(401, { error: "Invalid username or password" });
  }

  const token = await createAdminSessionToken(username, secret, 60 * 60 * 8);
  return json(200, { ok: true, token, expiresIn: 28800 });
});

