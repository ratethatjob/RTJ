import { getTranslations } from "next-intl/server";
import { sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/seo";
import { type BillingCurrency, proPrice } from "@/lib/stripe";
import type { adminClient } from "@/lib/supabase/admin";

// Billing emails that are not in-app notifications (billing_notices, one per location/kind/ref):
// the yearly renewal reminder 7 days before (written by process_renewals(), sent by the daily cron)
// and the cancellation confirmation (written and sent by the Stripe webhook).

type Db = NonNullable<ReturnType<typeof adminClient>>;
type Kind = "renewal_upcoming" | "subscription_canceled";
type Notice = { id: string; location_id: string; org_id: string; kind: Kind; data: Record<string, unknown> };

const billingLink = (locale: string) => `${SITE_URL}${locale === "en" ? "" : `/${locale}`}/business/billing`;

/** Records the notice (once per ref) and emails it right away. */
export async function sendBillingNotice(
  db: Db,
  n: { locationId: string; orgId: string; kind: Kind; ref: string; endsAt: string | null },
) {
  const { data: place } = await db.from("locations").select("name, address").eq("id", n.locationId).maybeSingle();
  const { data: row } = await db
    .from("billing_notices")
    .upsert(
      {
        location_id: n.locationId,
        org_id: n.orgId,
        kind: n.kind,
        ref: n.ref,
        data: { location: place?.name ?? "", address: place?.address ?? "", ends_at: n.endsAt },
      },
      { onConflict: "location_id,kind,ref", ignoreDuplicates: true },
    )
    .select("id, location_id, org_id, kind, data")
    .maybeSingle();
  if (row) await emailNotice(db, row as Notice);
}

/** Daily cron: notices not emailed yet (renewal reminders). */
export async function sendPendingBillingNotices(db: Db) {
  const { data: rows } = await db
    .from("billing_notices")
    .select("id, location_id, org_id, kind, data")
    .is("emailed_at", null)
    .gte("created_at", new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString())
    .limit(200);
  let sent = 0;
  for (const n of (rows ?? []) as Notice[]) sent += await emailNotice(db, n);
  return sent;
}

async function emailNotice(db: Db, n: Notice) {
  let sent = 0;
  let tried = 0;
  try {
    const { data: members } = await db
      .from("org_members")
      .select("user_id")
      .eq("org_id", n.org_id)
      .in("role", ["owner", "hr"]);
    for (const m of members ?? []) {
      const { data: user } = await db.auth.admin.getUserById(m.user_id);
      const email = user.user?.email;
      if (!email) continue;
      const { data: profile } = await db.from("profiles").select("preferred_locale").eq("user_id", m.user_id).maybeSingle();
      const locale = profile?.preferred_locale === "hu" ? "hu" : "en";
      const t = await getTranslations({ locale, namespace: "Email" });
      const d = n.data;
      const location = [d.location, d.address].filter(Boolean).join(", ");
      const when = (d.renews_at ?? d.ends_at) as string | null;
      const date = when ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(when)) : "";
      const currency = (d.currency === "huf" ? "huf" : "eur") as BillingCurrency;
      const amount = new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency.toUpperCase(),
        maximumFractionDigits: 0,
      }).format(proPrice(currency, "year"));
      const values = { location, date, amount, link: billingLink(locale) };
      tried += 1;
      if (await sendEmail(email, t(`${n.kind}Subject`, values), t(`${n.kind}Body`, values))) sent += 1;
    }
  } catch (e) {
    console.error("billing notice", n.kind, e);
  }
  // Retried next day (within 3 days) only when every send failed, e.g. an email outage;
  // no address at all doesn't retry.
  if (sent > 0 || tried === 0) {
    await db.from("billing_notices").update({ emailed_at: new Date().toISOString() }).eq("id", n.id);
  }
  return sent;
}
