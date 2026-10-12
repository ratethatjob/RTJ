import Stripe from "stripe";
import { adminClient } from "./supabase/admin";
import { SITE_URL } from "./seo";
import { invoiceFooter as footerFor, invoiceSeller, taxExemptFor } from "./invoice-tax";
import { jobPricing, type JobTier, OPERATOR, proPrice as listPrice } from "./site-config";


export { taxExemptFor } from "./invoice-tax";
/** Seller line at the top of every invoice footer (official name, Meydan address, TRN). */
export const INVOICE_SELLER = invoiceSeller(OPERATOR.taxNumber);
/** Invoice footer for a customer's tax status: the seller line plus the legal basis. */
export const invoiceFooter = (taxExempt: string | null | undefined) => footerFor(taxExempt, OPERATOR.taxNumber);

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
  return listPrice(currency === "huf" ? "HUF" : "EUR", interval) ?? 0;
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
 *  price change in PRO_MONTHLY creates a new price; existing subscriptions keep theirs). */
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

/** Customer Portal (our own configuration, so the Dashboard's default portal settings don't apply):
 *  card change, invoices, billing details incl. tax ID, cancelling at the period end, and switching
 *  between monthly and yearly Pro (the difference is invoiced right away). */
export async function portalConfiguration(s: Stripe) {
  if (portalConfig) return portalConfig;
  const existing = (await s.billingPortal.configurations.list({ active: true, limit: 100 })).data.find(
    (c) => c.metadata?.rtj === "v2",
  );
  if (existing) return (portalConfig = existing.id);
  const prices = await Promise.all(
    (["huf", "eur"] as const).flatMap((c) => (["month", "year"] as const).map((i) => proPriceId(s, c, i))),
  );
  portalConfig = (
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
          subscription_update: {
            enabled: true,
            default_allowed_updates: ["price"],
            products: [{ product: PRO_PRODUCT, prices }],
            proration_behavior: "always_invoice",
          },
        },
        default_return_url: `${SITE_URL}/business/billing`,
        metadata: { rtj: "v2" },
      },
      { idempotencyKey: "portal-config-v2" },
    )
  ).id;
  return portalConfig;
}

/** Link to an object in the Stripe dashboard (admin). */
export function dashboardUrl(kind: "customers" | "subscriptions" | "payments", id: string) {
  return `https://dashboard.stripe.com/${kind}/${id}`;
}

// ---------------------------------------------------------------------------
// VAT status of the buyer (no Stripe Tax: the invoice footer text is set in the Stripe Dashboard).
// EU business with an EU VAT number → reverse charge; outside the EU and the UAE → exempt;
// UAE (and EU without a VAT number) → none.
// ---------------------------------------------------------------------------

let accountTaxId: string | null = null;

/** Our UAE TRN as an account tax ID (created once through the API, found again by its value),
 *  so invoices list it under the seller. null if Stripe refuses it. */
export async function accountTaxIds(s: Stripe): Promise<string[]> {
  if (!accountTaxId) {
    try {
      const list = await s.taxIds.list({ owner: { type: "account" }, limit: 100 });
      accountTaxId =
        list.data.find((t) => t.type === "ae_trn" && t.value.replace(/\D/g, "") === OPERATOR.taxNumber)?.id ??
        (await s.taxIds.create({ type: "ae_trn", value: OPERATOR.taxNumber, owner: { type: "account" } })).id;
    } catch (e) {
      console.error("accountTaxIds", e);
      return [];
    }
  }
  return [accountTaxId];
}

/** What a customer's invoices will carry, after a sync (for the admin check). */
export type InvoiceSetup = { customerId: string; taxExempt: string | null; footer: string | null; subscriptions: number };

/** Sets the customer's tax_exempt from its billing country and tax IDs, the matching invoice
 *  footer, and our TRN on its live subscriptions (each only when it differs). Run before each
 *  Checkout, from the webhook and daily, so every invoice carries the right status and text. */
export async function syncTaxExempt(s: Stripe, customerId: string): Promise<InvoiceSetup | null> {
  const customer = await s.customers.retrieve(customerId, { expand: ["tax_ids"] });
  if (customer.deleted) return null;
  const wanted = taxExemptFor(
    customer.address?.country,
    (customer.tax_ids?.data ?? []).map((t) => t.type),
  );
  const exempt = wanted ?? customer.tax_exempt;
  const footer = invoiceFooter(exempt);
  const update: Stripe.CustomerUpdateParams = {};
  if (wanted && wanted !== customer.tax_exempt) update.tax_exempt = wanted;
  if (customer.invoice_settings?.footer !== footer) update.invoice_settings = { footer };
  if (Object.keys(update).length) await s.customers.update(customerId, update);

  const ids = await accountTaxIds(s);
  const subs = await s.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
  const live = subs.data.filter((sub) => ["active", "trialing", "past_due", "unpaid", "incomplete"].includes(sub.status));
  for (const sub of live) {
    const has = (sub.invoice_settings?.account_tax_ids ?? []).map((t) => (typeof t === "string" ? t : t.id));
    if (ids.length && ids.some((id) => !has.includes(id))) {
      await s.subscriptions.update(sub.id, { invoice_settings: { account_tax_ids: ids } });
    }
  }
  return { customerId, taxExempt: exempt ?? null, footer, subscriptions: live.length };
}

export type BillingDetails = {
  name: string | null;
  address: string[];
  taxIds: { type: string; value: string }[];
};

/** Billing name, address and tax IDs as Stripe has them (shown on the plan page). */
export async function billingDetails(s: Stripe, customerId: string): Promise<BillingDetails | null> {
  const customer = await s.customers.retrieve(customerId, { expand: ["tax_ids"] });
  if (customer.deleted) return null;
  const a = customer.address;
  return {
    name: customer.name ?? null,
    address: a
      ? [a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(" "), a.state, a.country].filter(
          (x): x is string => Boolean(x),
        )
      : [],
    taxIds: (customer.tax_ids?.data ?? []).map((t) => ({ type: t.type, value: t.value })),
  };
}

/** One customer's invoice setup after a sync, with its next subscription invoice (admin check). */
export type InvoiceCheck = InvoiceSetup & {
  orgName: string;
  next: { amountDue: number; currency: string; date: string | null; footer: string | null; accountTaxIds: number }[];
};

/** Syncs every org's Stripe customer (tax status, footer, our TRN) and previews the next
 *  invoice of each live subscription. Daily from the cron and on demand from the admin. */
export async function syncAllInvoiceSetups(
  s: Stripe,
  db: NonNullable<ReturnType<typeof adminClient>>,
): Promise<InvoiceCheck[]> {
  const { data: orgs } = await db.from("orgs").select("name, stripe_customer_id").not("stripe_customer_id", "is", null);
  const out: InvoiceCheck[] = [];
  for (const org of orgs ?? []) {
    try {
      const setup = await syncTaxExempt(s, org.stripe_customer_id as string);
      if (!setup) continue;
      const subs = await s.subscriptions.list({ customer: setup.customerId, status: "all", limit: 100 });
      const next = [];
      for (const sub of subs.data.filter((x) => ["active", "trialing", "past_due"].includes(x.status) && !x.cancel_at_period_end)) {
        const inv = await s.invoices.createPreview({ subscription: sub.id }).catch(() => null);
        if (!inv) continue;
        const when = inv.next_payment_attempt ?? inv.period_end;
        next.push({
          amountDue: inv.amount_due,
          currency: inv.currency,
          date: when ? new Date(when * 1000).toISOString() : null,
          footer: inv.footer ?? null,
          accountTaxIds: inv.account_tax_ids?.length ?? 0,
        });
      }
      out.push({ ...setup, orgName: org.name as string, next });
    } catch (e) {
      console.error("syncAllInvoiceSetups", org.stripe_customer_id, e);
    }
  }
  return out;
}
