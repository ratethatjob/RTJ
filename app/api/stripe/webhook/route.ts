import { revalidateTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import type Stripe from "stripe";
import { sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/seo";
import { stripe, syncTaxExempt } from "@/lib/stripe";
import { adminClient } from "@/lib/supabase/admin";

// Stripe webhook (https://ratethatjob.com/api/stripe/webhook). Verifies the signature, handles each
// event once (stripe_events), mirrors payments into job_orders and location_plans, and keeps the
// customer's tax_exempt (reverse charge / exempt) in line with its billing country and tax IDs.
// Errors return 500 so Stripe retries.

type Db = NonNullable<ReturnType<typeof adminClient>>;

export async function POST(request: Request) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const db = adminClient();
  if (!s || !secret || !db) return new Response("Not configured", { status: 503 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(body, request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }

  const { data: seen } = await db.from("stripe_events").select("id").eq("id", event.id).maybeSingle();
  if (seen) return Response.json({ received: true, duplicate: true });

  try {
    await handle(event, s, db);
  } catch (e) {
    console.error("stripe webhook", event.type, event.id, e);
    return new Response("Handler failed", { status: 500 });
  }
  await db.from("stripe_events").insert({ id: event.id, type: event.type });
  return Response.json({ received: true });
}

async function handle(event: Stripe.Event, s: Stripe, db: Db) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (session.mode === "payment" && session.metadata?.job_order_id && session.payment_status === "paid") {
        await fulfillJobOrder(db, session);
      } else if (session.mode === "subscription" && session.subscription) {
        await syncSubscription(s, db, idOf(session.subscription));
      }
      // The billing address and tax ID were just collected: set reverse charge / exempt.
      if (session.customer) await syncTaxExempt(s, idOf(session.customer));
      return;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const sub = invoice.parent?.subscription_details?.subscription;
      if (!sub) return;
      const result = await syncSubscription(s, db, idOf(sub));
      // One notice per failed invoice (Stripe retries the card several times).
      if (event.type === "invoice.payment_failed" && result && (invoice.attempt_count ?? 1) <= 1) {
        await notifyPaymentFailed(db, result.locationId, result.orgId);
      }
      return;
    }
    // Billing country or tax ID changed (Checkout, Customer Portal): reverse charge / exempt.
    case "customer.updated":
      await syncTaxExempt(s, event.data.object.id);
      return;
    case "customer.tax_id.created":
    case "customer.tax_id.updated":
    case "customer.tax_id.deleted": {
      const customer = event.data.object.customer;
      if (customer) await syncTaxExempt(s, idOf(customer));
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(s, db, event.data.object.id);
      return;
  }
}

const idOf = (v: string | { id: string }) => (typeof v === "string" ? v : v.id);

async function fulfillJobOrder(db: Db, session: Stripe.Checkout.Session) {
  const { data: newlyPaid, error } = await db.rpc("stripe_fulfill_job_order", {
    p_order_id: session.metadata!.job_order_id,
    p_session_id: session.id,
    p_payment_intent: session.payment_intent ? idOf(session.payment_intent) : null,
    p_amount: session.amount_total,
    p_currency: session.currency,
  });
  if (error) throw error;
  if (newlyPaid) {
    const jobId = session.metadata?.job_id;
    revalidateTag("jobs", "max");
    if (jobId) revalidateTag(`job:${jobId}`, "max");
  }
}

/** Re-reads the subscription (events can arrive out of order) and mirrors it on the location. */
async function syncSubscription(s: Stripe, db: Db, subscriptionId: string) {
  const sub = await s.subscriptions.retrieve(subscriptionId);
  const locationId = sub.metadata?.location_id;
  if (!locationId) return null;
  const item = sub.items.data[0];
  const periodEnd = Math.max(0, ...sub.items.data.map((i) => i.current_period_end ?? 0));
  const { data: orgId, error } = await db.rpc("stripe_sync_subscription", {
    p_location_id: locationId,
    p_subscription_id: sub.id,
    p_customer_id: idOf(sub.customer),
    p_status: sub.status,
    p_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    p_cancel_at_period_end: sub.cancel_at_period_end,
    p_interval: item?.price.recurring?.interval ?? null,
    p_currency: sub.currency,
  });
  if (error) throw error;
  // Pro decides what the embedded Index shows.
  revalidateTag("locations", "max");
  return orgId ? { locationId, orgId: orgId as string } : null;
}

/** In-app notice and email to the org's owners and HR. Never blocks the webhook. */
async function notifyPaymentFailed(db: Db, locationId: string, orgId: string) {
  try {
    const [{ data: place }, { data: members }] = await Promise.all([
      db.from("locations").select("name, address").eq("id", locationId).single(),
      db.from("org_members").select("user_id").eq("org_id", orgId).in("role", ["owner", "hr"]),
    ]);
    const location = place ? `${place.name}, ${place.address}` : "";
    for (const m of members ?? []) {
      await db.from("notifications").insert({
        user_id: m.user_id,
        kind: "payment_failed",
        data: { location_id: locationId, location: place?.name ?? "", address: place?.address ?? "" },
      });
      const { data: user } = await db.auth.admin.getUserById(m.user_id);
      const email = user.user?.email;
      if (!email) continue;
      const { data: profile } = await db.from("profiles").select("preferred_locale").eq("user_id", m.user_id).maybeSingle();
      const locale = profile?.preferred_locale === "hu" ? "hu" : "en";
      const t = await getTranslations({ locale, namespace: "Email" });
      const link = `${SITE_URL}${locale === "en" ? "" : `/${locale}`}/business/locations#plan`;
      await sendEmail(email, t("payment_failedSubject", { location }), t("payment_failedBody", { location, link }));
    }
  } catch (e) {
    console.error("payment failed notice", e);
  }
}
