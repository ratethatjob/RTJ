"use server";

import { getUser } from "@/lib/auth";
import { encryptEmail, hashEmail, inviteCryptoReady, normalizeEmail } from "@/lib/invite-crypto";
import { sendInviteEmails } from "@/lib/invite-emails";
import { MAX_INVITES } from "@/lib/invites";
import { rateLimited } from "@/lib/rate-limit";
import { adminClient } from "@/lib/supabase/admin";

export type InviteEntry = { email: string; locale?: string };
export type InviteResult =
  | { ok: true; sent: number; skipped: number }
  | { ok: false; error: "config" | "limit" | "tooMany" | "invalid" | "generic" };

const LOCALES = ["en", "hu"];

export async function sendInvites(locationId: string, entries: InviteEntry[], defaultLocale: string): Promise<InviteResult> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "generic" };
  const db = adminClient();
  if (!db || !process.env.RESEND_API_KEY || !inviteCryptoReady()) return { ok: false, error: "config" };
  if (rateLimited(`invites:${user.id}`, 5, 60_000)) return { ok: false, error: "limit" };
  if (!Array.isArray(entries) || entries.length > MAX_INVITES) return { ok: false, error: "tooMany" };

  const people = new Map<string, string | undefined>();
  for (const e of entries) {
    const email = typeof e?.email === "string" ? normalizeEmail(e.email) : null;
    if (email && !people.has(email)) people.set(email, LOCALES.includes(e.locale ?? "") ? e.locale : undefined);
  }
  if (!people.size) return { ok: false, error: "invalid" };

  // Language: the CSV column, else the person's account language, else the batch default.
  const { data: known } = await db.rpc("invite_known_locales", { p_emails: [...people.keys()] });
  const knownLocale = new Map((known as { email: string; locale: string }[] | null)?.map((k) => [k.email, k.locale]));
  const fallback = LOCALES.includes(defaultLocale) ? defaultLocale : "en";
  const byHash = new Map<string, string>();
  const items = [...people].map(([email, locale]) => {
    const hash = hashEmail(email);
    byHash.set(hash, email);
    return { hash, enc: encryptEmail(email), locale: locale ?? knownLocale.get(email) ?? fallback };
  });

  const { data: created, error } = await supabase.rpc("create_email_invites", {
    p_location_id: locationId,
    p_invites: items,
  });
  if (error) return { ok: false, error: error.code === "54000" ? "limit" : "generic" };
  const rows = (created ?? []) as { id: string; contact_hash: string; locale: string }[];
  let sent = 0;
  if (rows.length) {
    const { data: tokens } = await db.from("invites").select("id, token").in("id", rows.map((r) => r.id));
    const tokenOf = new Map(tokens?.map((t) => [t.id as string, t.token as string]));
    sent = await sendInviteEmails(
      db,
      rows
        .filter((r) => tokenOf.has(r.id))
        .map((r) => ({ id: r.id, token: tokenOf.get(r.id)!, locale: r.locale, email: byHash.get(r.contact_hash)!, locationId })),
      false,
    );
  }
  return { ok: true, sent, skipped: entries.length - sent };
}
