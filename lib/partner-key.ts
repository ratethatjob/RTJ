import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { adminClient } from "@/lib/supabase/admin";

// Partner keys (admin "Partner keys" tab): a trusted importer sends its key in the
// X-RTJ-Partner-Key header with every request (for a browser bot: as an extra HTTP header on all
// requests). Only the SHA-256 hash is stored. With an active key, picking a map place skips the
// per-IP and the all-visitors limits (lib/place-ensure.ts); the key's own hourly ceiling applies.

export const PARTNER_HEADER = "x-rtj-partner-key";

export type Partner = { id: string; name: string; hourlyLimit: number };

export const hashPartnerKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** The active partner key sent with this request, or null. Counts the use. */
export async function requestPartner(): Promise<Partner | null> {
  const key = (await headers()).get(PARTNER_HEADER)?.trim() ?? "";
  if (key.length < 32 || key.length > 200) return null;
  const db = adminClient();
  if (!db) return null;
  const { data } = await db.rpc("partner_key_use", { p_hash: hashPartnerKey(key) });
  const row = ((data ?? []) as { id: string; name: string; hourly_limit: number }[])[0];
  return row ? { id: row.id, name: row.name, hourlyLimit: row.hourly_limit } : null;
}
