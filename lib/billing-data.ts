import type Stripe from "stripe";
import { type BillingDetails, billingDetails, stripe } from "@/lib/stripe";
import { adminClient } from "@/lib/supabase/admin";

// Live billing data for the Subscription page, read from Stripe: each location's subscription
// (price, next charge, card), the org's billing details and its latest invoices.
// Every call is optional: without Stripe or on an API error the page still renders from our data.

export type Card = { brand: string; last4: string; expMonth: number; expYear: number };

export type SubscriptionInfo = {
  /** Price per period in the currency's major unit (e.g. 39 EUR, 12 900 HUF). */
  amount: number;
  currency: string;
  interval: "month" | "year";
  /** Next invoice total (with any proration) and when it's charged. */
  nextAmount: number | null;
  nextChargeAt: string | null;
  card: Card | null;
};

export type InvoiceRow = {
  id: string;
  number: string | null;
  date: string;
  total: number;
  currency: string;
  status: string;
  pdf: string | null;
  url: string | null;
};

export type BillingData = {
  details: BillingDetails | null;
  invoices: InvoiceRow[];
  subscriptions: Map<string, SubscriptionInfo>;
};

// HUF and EUR both use two decimals in Stripe (HUF whole forints × 100, see toMinor()).
const major = (amount: number) => amount / 100;

function cardOf(pm: string | Stripe.PaymentMethod | null | undefined): Card | null {
  if (!pm || typeof pm === "string" || !pm.card) return null;
  return { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year };
}

export async function loadBillingData(orgId: string, locationIds: string[]): Promise<BillingData> {
  const empty: BillingData = { details: null, invoices: [], subscriptions: new Map() };
  const s = stripe();
  const db = adminClient();
  if (!s || !db) return empty;
  const [{ data: org }, { data: plans }] = await Promise.all([
    db.from("orgs").select("stripe_customer_id").eq("id", orgId).single(),
    locationIds.length
      ? db
          .from("location_plans")
          .select("location_id, stripe_subscription_id, stripe_status")
          .eq("org_id", orgId)
          .in("location_id", locationIds)
      : Promise.resolve({ data: [] as { location_id: string; stripe_subscription_id: string | null; stripe_status: string | null }[] }),
  ]);
  const customerId = org?.stripe_customer_id as string | null;
  if (!customerId) return empty;

  const [details, defaultCard, invoices] = await Promise.all([
    billingDetails(s, customerId).catch(() => null),
    s.customers
      .retrieve(customerId, { expand: ["invoice_settings.default_payment_method"] })
      .then((c) => (c.deleted ? null : cardOf(c.invoice_settings?.default_payment_method)))
      .catch(() => null),
    s.invoices
      .list({ customer: customerId, limit: 10 })
      .then((r) =>
        r.data
          .filter((i) => i.status !== "draft")
          .map<InvoiceRow>((i) => ({
            id: i.id!,
            number: i.number ?? null,
            date: new Date(i.created * 1000).toISOString(),
            total: major(i.total),
            currency: i.currency,
            status: i.status ?? "open",
            pdf: i.invoice_pdf ?? null,
            url: i.hosted_invoice_url ?? null,
          })),
      )
      .catch(() => []),
  ]);

  const subscriptions = new Map<string, SubscriptionInfo>();
  await Promise.all(
    (plans ?? [])
      .filter((p) => p.stripe_subscription_id && ["active", "trialing", "past_due", "unpaid"].includes(p.stripe_status ?? ""))
      .map(async (p) => {
        try {
          const sub = await s.subscriptions.retrieve(p.stripe_subscription_id!, { expand: ["default_payment_method"] });
          const price = sub.items.data[0]?.price;
          if (!price?.unit_amount || !price.recurring) return;
          const periodEnd = Math.max(0, ...sub.items.data.map((i) => i.current_period_end ?? 0));
          const willCharge = !sub.cancel_at_period_end && !sub.cancel_at;
          const preview = willCharge
            ? await s.invoices.createPreview({ subscription: sub.id }).catch(() => null)
            : null;
          subscriptions.set(p.location_id, {
            amount: major(price.unit_amount),
            currency: price.currency,
            interval: price.recurring.interval === "year" ? "year" : "month",
            nextAmount: preview ? major(preview.amount_due) : null,
            nextChargeAt: willCharge && periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            card: cardOf(sub.default_payment_method) ?? defaultCard,
          });
        } catch (e) {
          console.error("billing data", p.stripe_subscription_id, e);
        }
      }),
  );
  return { details, invoices, subscriptions };
}
