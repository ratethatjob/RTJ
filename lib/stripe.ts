import Stripe from "stripe";
import { adminClient } from "./supabase/admin";
import { SITE_URL } from "./seo";
import { jobPricing, type JobTier, PRICING, YEARLY_MONTHS } from "./site-config";

// Stripe (live keys on Vercel): Pro subscriptions per location and one-time job ad payments.
// Products, prices and the Customer Portal configuration are created here on first use
// (found again by lookup_key / metadata), so nothing has to be set up by hand in Stripe.
// Without STRIPE_SECRET_KEY everything falls back to invoices marked paid by an admin.

let client: Stripe | null = null;

export function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key, { maxNetworkRetries: 2, appInfo: { name: "RateThatJob", url: SITE_URL } });
  return client;
}

export type BillingCurrency = "huf" | "eur";
export type Interval = "month" | "year";

/** Hungarian locations pay in forints, everyone else in euros. */
export const billingCurrency = (country: string): BillingCurrency => (country === "HU" ? "huf" : "eur");

/** Stripe's smallest unit. HUF is a two-decimal currency in Stripe but must be whole forints. */
export function toMinor(amount: number, currency: BillingCurrency) {
  return currency === "huf" ? Math.round(amount) * 100 : Math.round(amount * 100);
}

/** Pro price per location for one billing period, in whole units. */
export function proPrice(currency: BillingCurrency, interval: Interval) {
  const monthly = PRICING[currency === "huf" ? "hu" : "en"].monthly ?? 0;
  return interval === "year" ? monthly * YEARLY_MONTHS : monthly;
}

/** Job ad price: the package, or the difference when moving up from `from`. */
export function jobOrderPrice(country: string, tier: JobTier, from: JobTier | null) {
  const pricing = jobPricing(country);
  const currency: BillingCurrency = pricing.currency === "HUF" ? "huf" : "eur";
  const amount = pricing.prices[tier] - (from ? pricing.prices[from] : 0);
  return { currency, amount: Math.max(0, amount) };
}

const PRO_PRODUCT = "rtj_pro";
const priceCache = new Map<string, string>();

/** The recurring Pro price for this currency and interval (lookup_key includes the amount, so a
 *  price change in PRICING creates a new price; existing subscriptions keep theirs). */
export async function proPriceId(s: Stripe, currency: BillingCurrency, interval: Interval) {
  const amount = proPrice(currency, interval);
  const key = `rtj_pro_${interval}_${currency}_${amount}`;
  const cached = priceCache.get(key);
  if (cached) return cached;
  const find = async () => (await s.prices.list({ lookup_keys: [key], active: true, limit: 1 })).data[0]?.id;
  let id = await find();
  if (!id) {
    await s.products.retrieve(PRO_PRODUCT).catch(() =>
      s.products.create(
        { id: PRO_PRODUCT, name: "RateThatJob Pro", description: "Pro plan for one workplace location" },
        { idempotencyKey: `product-${PRO_PRODUCT}` },
      ),
    );
    id = await s.prices
      .create(
        {
          product: PRO_PRODUCT,
          currency,
          unit_amount: toMinor(amount, currency),
          recurring: { interval },
          lookup_key: key,
          nickname: `Pro ${interval}ly ${amount} ${currency.toUpperCase()}`,
        },
        { idempotencyKey: `price-${key}` },
      )
      .then((p) => p.id)
      .catch(async () => (await find()) ?? Promise.reject(new Error("price not created")));
  }
  priceCache.set(key, id);
  return id;
}

/** The org's Stripe customer (one per org), created on first payment. */
export async function orgCustomer(s: Stripe, orgId: string, email: string | null, locale: string) {
  const db = adminClient();
  if (!db) throw new Error("SUPABASE_SECRET_KEY missing");
  const { data: org } = await db.from("orgs").select("name, stripe_customer_id").eq("id", orgId).single();
  if (org?.stripe_customer_id) return org.stripe_customer_id as string;
  const customer = await s.customers.create(
    {
      name: org?.name ?? undefined,
      email: email ?? undefined,
      preferred_locales: [locale === "hu" ? "hu" : "en"],
      metadata: { org_id: orgId },
    },
    { idempotencyKey: `org-customer-${orgId}` },
  );
  // Another request may have stored one first; keep whichever landed.
  await db.from("orgs").update({ stripe_customer_id: customer.id }).eq("id", orgId).is("stripe_customer_id", null);
  const { data: again } = await db.from("orgs").select("stripe_customer_id").eq("id", orgId).single();
  return (again?.stripe_customer_id as string) ?? customer.id;
}

let portalConfig: string | null = null;

/** Customer Portal: card change, invoices, billing details and cancelling at the period end. */
export async function portalConfiguration(s: Stripe) {
  if (portalConfig) return portalConfig;
  const existing = (await s.billingPortal.configurations.list({ active: true, limit: 100 })).data.find(
    (c) => c.metadata?.rtj === "v1",
  );
  portalConfig =
    existing?.id ??
    (
      await s.billingPortal.configurations.create(
        {
          business_profile: {
            privacy_policy_url: `${SITE_URL}/privacy`,
            terms_of_service_url: `${SITE_URL}/terms`,
          },
          features: {
            customer_update: { enabled: true, allowed_updates: ["name", "email", "address", "tax_id"] },
            invoice_history: { enabled: true },
            payment_method_update: { enabled: true },
            subscription_cancel: { enabled: true, mode: "at_period_end" },
          },
          default_return_url: `${SITE_URL}/business/locations`,
          metadata: { rtj: "v1" },
        },
        { idempotencyKey: "portal-config-v1" },
      )
    ).id;
  return portalConfig;
}

/** Link to an object in the Stripe dashboard (admin). */
export function dashboardUrl(kind: "customers" | "subscriptions" | "payments", id: string) {
  return `https://dashboard.stripe.com/${kind}/${id}`;
}
