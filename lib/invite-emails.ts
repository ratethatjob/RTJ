import type { SupabaseClient } from "@supabase/supabase-js";
import { getTranslations } from "next-intl/server";
import { getLocationById } from "./data";
import { sendEmailBatch } from "./email";
import { SITE_URL } from "./seo";

export type InviteToSend = { id: string; token: string; locale: string; email: string; locationId: string };

const localePath = (locale: string) => (locale === "en" ? "" : `/${locale}`);

/** Sends the invite (or its one reminder) in each person's language and marks them sent. */
export async function sendInviteEmails(db: SupabaseClient, invites: InviteToSend[], reminder: boolean) {
  const names = new Map<string, { company: string; location: string }>();
  for (const id of new Set(invites.map((i) => i.locationId))) {
    const l = await getLocationById(id);
    if (l) names.set(id, { company: l.companyName, location: l.name === l.companyName ? l.address : `${l.name}, ${l.address}` });
  }
  const ready = invites.filter((i) => names.has(i.locationId));
  const emails = await Promise.all(
    ready.map(async (i) => {
      const locale = i.locale === "hu" ? "hu" : "en";
      const t = await getTranslations({ locale, namespace: "InviteEmail" });
      const values = {
        ...names.get(i.locationId)!,
        link: `${SITE_URL}${localePath(locale)}/r/${i.token}`,
        unsubscribe: `${SITE_URL}${localePath(locale)}/r/${i.token}/unsubscribe`,
      };
      return {
        to: i.email,
        subject: t(reminder ? "reminderSubject" : "subject", values),
        text: t(reminder ? "reminderBody" : "body", values),
        headers: {
          "List-Unsubscribe": `<${SITE_URL}/api/unsubscribe?t=${encodeURIComponent(i.token)}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
    }),
  );
  const ok = await sendEmailBatch(emails);
  const sent = ready.filter((_, n) => ok[n]).map((i) => i.id);
  if (sent.length) await db.rpc("invite_mark_sent", { p_ids: sent, p_reminder: reminder });
  return sent.length;
}
