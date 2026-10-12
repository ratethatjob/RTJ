import { getTranslations } from "next-intl/server";
import { sendEmail } from "@/lib/email";
import { decryptEmail } from "@/lib/invite-crypto";
import { type InviteToSend, sendInviteEmails } from "@/lib/invite-emails";
import { sendPendingBillingNotices } from "@/lib/billing-notices";
import { SITE_URL } from "@/lib/seo";
import { stripe, syncAllInvoiceSetups } from "@/lib/stripe";
import { adminClient } from "@/lib/supabase/admin";

// Daily: emails the Pro trial notices (written in-app by process_trials()) and billing notices
// (yearly renewal reminders from process_renewals()) to owners and HR, cancels the Stripe
// subscriptions of locations that left their org (stripe_cancel_queue),
// keeps every Stripe customer's tax status, invoice footer and our TRN in line,
// and the one reminder for email invites sent 5+ days ago and not used yet (then the address is cleared).
// Needs SUPABASE_SECRET_KEY; without RESEND_API_KEY only the Stripe upkeep runs and notices stay in-app.
const KINDS = ["trial_ending", "trial_ended"];

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const db = adminClient();
  if (!db) return Response.json({ sent: 0, skipped: "not configured" });
  // Stripe upkeep doesn't need email.
  const cancelled = await cancelOrphanSubscriptions(db);
  const invoiceSetups = await syncInvoiceSetups(db);
  if (!process.env.RESEND_API_KEY) return Response.json({ sent: 0, skipped: "no email", cancelled, invoiceSetups });

  const since = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const { data: rows } = await db
    .from("notifications")
    .select("id, user_id, kind, data")
    .in("kind", KINDS)
    .is("emailed_at", null)
    .gte("created_at", since)
    .limit(200);

  let sent = 0;
  for (const n of rows ?? []) {
    const { data: user } = await db.auth.admin.getUserById(n.user_id);
    const email = user.user?.email;
    if (email) {
      const { data: profile } = await db.from("profiles").select("preferred_locale").eq("user_id", n.user_id).maybeSingle();
      const locale = profile?.preferred_locale === "hu" ? "hu" : "en";
      const t = await getTranslations({ locale, namespace: "Email" });
      const data = n.data as { location?: string; days?: number };
      const values = { location: data.location ?? "", days: data.days ?? 0 };
      const link = `${SITE_URL}${locale === "en" ? "" : `/${locale}`}/business/billing`;
      const ok = await sendEmail(
        email,
        t(`${n.kind}Subject`, values),
        t(`${n.kind}Body`, { ...values, link }),
      );
      if (ok) sent += 1;
      // A failed send (e.g. email outage) is tried again tomorrow, within 3 days.
      if (!ok) continue;
    }
    // No address: marked anyway so it doesn't retry forever.
    await db.from("notifications").update({ emailed_at: new Date().toISOString() }).eq("id", n.id);
  }
  return Response.json({
    sent,
    billing: await sendPendingBillingNotices(db),
    cancelled,
    reminders: await sendInviteReminders(db),
    invoiceSetups,
  });
}

/** Subscriptions of locations that left the org (stripe_cancel_queue): cancelled now, no new charges. */
async function cancelOrphanSubscriptions(db: NonNullable<ReturnType<typeof adminClient>>) {
  const s = stripe();
  if (!s) return 0;
  const { data: rows } = await db.from("stripe_cancel_queue").select("subscription_id").is("done_at", null).limit(50);
  let n = 0;
  for (const r of rows ?? []) {
    try {
      const sub = await s.subscriptions.retrieve(r.subscription_id);
      if (sub.status !== "canceled" && sub.status !== "incomplete_expired") {
        await s.subscriptions.cancel(r.subscription_id, { invoice_now: false, prorate: false });
      }
      await db.from("stripe_cancel_queue").update({ done_at: new Date().toISOString(), error: null }).eq("subscription_id", r.subscription_id);
      n += 1;
    } catch (e) {
      await db
        .from("stripe_cancel_queue")
        .update({ error: e instanceof Error ? e.message.slice(0, 300) : "error" })
        .eq("subscription_id", r.subscription_id);
    }
  }
  return n;
}

async function sendInviteReminders(db: NonNullable<ReturnType<typeof adminClient>>) {
  const due = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
  const { data: rows } = await db
    .from("invites")
    .select("id, token, locale, contact_encrypted, invite_batches!inner(location_id)")
    .eq("channel", "email")
    .is("reminded_at", null)
    .is("used_at", null)
    .not("contact_encrypted", "is", null)
    .lte("sent_at", due)
    .limit(500);
  const invites: InviteToSend[] = [];
  for (const r of rows ?? []) {
    const email = decryptEmail(r.contact_encrypted as string);
    const batch = r.invite_batches as unknown as { location_id: string };
    if (email) invites.push({ id: r.id, token: r.token, locale: r.locale ?? "en", email, locationId: batch.location_id });
  }
  return invites.length ? sendInviteEmails(db, invites, true) : 0;
}

async function syncInvoiceSetups(db: NonNullable<ReturnType<typeof adminClient>>) {
  const s = stripe();
  return s ? (await syncAllInvoiceSetups(s, db)).length : 0;
}
