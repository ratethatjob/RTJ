import { createHash, timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/supabase/admin";

// Who may run the OSM import from outside (scripts/osm-import.ts): the cron secret, or a
// short-lived token stored as a SHA-256 hash in public.import_tokens (created by hand with SQL).
export async function importAllowed(request: Request): Promise<boolean> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return false;
  const secret = process.env.CRON_SECRET;
  if (secret && token.length === secret.length && timingSafeEqual(Buffer.from(token), Buffer.from(secret))) return true;
  const db = adminClient();
  if (!db || token.length < 32) return false;
  const hash = createHash("sha256").update(token).digest("hex");
  const { data } = await db
    .from("import_tokens")
    .select("token_hash")
    .eq("token_hash", hash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return Boolean(data);
}
