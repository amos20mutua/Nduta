import { json } from "./response.ts";
import { verifyAdminSessionToken } from "./admin-session.ts";

export async function requireAdminKey(req: Request): Promise<Response | null> {
  const sessionToken = req.headers.get("x-admin-session") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const sessionSecret = String(Deno.env.get("ADMIN_SESSION_SECRET") || "");
  if (sessionToken && sessionSecret) {
    const session = await verifyAdminSessionToken(sessionToken, sessionSecret);
    if (session) return null;
  }

  const adminKey = Deno.env.get("ADMIN_API_KEY") || "";
  if (!adminKey) {
    return json(503, { error: "Admin key is not configured on server" });
  }
  const token = req.headers.get("x-admin-key") || "";
  if (!token || token !== adminKey) {
    return json(401, { error: "Unauthorized" });
  }
  return null;
}
