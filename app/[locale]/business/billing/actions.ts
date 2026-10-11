"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { getUser } from "@/lib/auth";
import { getBusiness } from "@/lib/business";
import { SITE_URL } from "@/lib/seo";
import type { JobTier } from "@/lib/site-config";
import { JOB_TIERS } from "@/lib/site-config";
import {
  billingCurrency,
  type Interval,
  jobOrderPrice,
  orgCustomer,
  portalConfiguration,
  proPriceId,
  stripe,
  toMinor,
} from "@/lib/stripe";
import { adminClient } from "@/lib/supabase/admin";

type Result = { url?: string; error?: "config" | "generic" | "subscribed" };

const localePath = (locale: string) => (locale === "en" ? "" : `/${locale}`);
const DAY = 24 * 3600;

/** Checkout for Pro on one location (subscription). Owners and HR only. */
export async function startProCheckout(locationId: string, interval: Interval): Promise<Result> {
  const s = stripe();
  if (!s || !adminClient()) return { error: "config" };
  if (interval !== "month" && interval !== "year") return { error: "generic" };
  const locale = await getLocale();
  const { supabase, user, org } = await getBusiness(locale, "/business/locations");
  const location = org?.locations.find((l) => l.id === locationId);
  if (!org || !location || (org.role !== "owner" && org.role !== "hr")) return { error: "generic" };

  const { data: plan } = await supabase
    .from("location_plans")
    .select("trial_ends_at, paid_until, stripe_status")
    .eq("location_id", locationId)
    .single();
  if (["active", "trialing", "past_due"].includes(plan?.stripe_status ?? "")) return { error: "subscribed" };

  try {
    const currency = billingCurrency(location.country);
    const customer = await orgCustomer(s, org.id, user.email ?? null, locale);
    // Not charged before the free trial (or a period paid by transfer) ends. Checkout needs a
    // trial end at least 48 hours away, so a trial ending sooner runs up to that point.
    const now = Math.floor(Date.now() / 1000);
    const coveredUntil = Math.max(
      plan?.trial_ends_at ? Math.floor(Date.parse(plan.trial_ends_at) / 1000) : 0,
      plan?.paid_until ? Math.floor(Date.parse(plan.paid_until) / 1000) : 0,
    );
    const trialEnd = coveredUntil > now ? Math.max(coveredUntil, now + 2 * DAY + 3600) : undefined;
    const base = `${SITE_URL}${localePath(locale)}/business/locations`;
    const session = await s.checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [{ price: await proPriceId(s, currency, interval), quantity: 1 }],
      subscription_data: {
        ...(trialEnd && { trial_end: trialEnd }),
        description: (await getTranslations("Billing"))("proLine", { location: `${location.name}, ${location.address}` }),
        metadata: { location_id: location.id, org_id: org.id },
      },
      metadata: { location_id: location.id, org_id: org.id, kind: "pro" },
      client_reference_id: location.id,
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      customer_update: { name: "auto", address: "auto" },
      locale: locale === "hu" ? "hu" : "en",
      success_url: `${base}?checkout=success#plan`,
      cancel_url: `${base}?checkout=cancelled#plan`,
    });
    return session.url ? { url: session.url } : { error: "generic" };
  } catch (e) {
    console.error("startProCheckout", e);
    return { error: "generic" };
  }
}

/** Stripe Customer Portal: card, invoices, billing details, cancel. Owners and HR only. */
export async function openBillingPortal(): Promise<Result> {
  const s = stripe();
  if (!s) return { error: "config" };
  const locale = await getLocale();
  const { org } = await getBusiness(locale, "/business/locations");
  if (!org || (org.role !== "owner" && org.role !== "hr")) return { error: "generic" };
  const db = adminClient();
  const { data } = db ? await db.from("orgs").select("stripe_customer_id").eq("id", org.id).single() : { data: null };
  if (!data?.stripe_customer_id) return { error: "generic" };
  try {
    const session = await s.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      configuration: await portalConfiguration(s),
      locale: locale === "hu" ? "hu" : "en",
      return_url: `${SITE_URL}${localePath(locale)}/business/locations#plan`,
    });
    return { url: session.url };
  } catch (e) {
    console.error("openBillingPortal", e);
    return { error: "generic" };
  }
}

export type JobPayment = { url?: string; pending?: true; error?: "generic" | "upgrade" };

/** Pay for publishing a job (or moving it up to `tier`): the order, then Checkout.
 *  Without Stripe the order waits for an invoice paid by transfer (admin marks it paid). */
export async function payForJob(jobId: string, tier: JobTier): Promise<JobPayment> {
  if (!JOB_TIERS.includes(tier)) return { error: "generic" };
  const { supabase, user } = await getUser();
  if (!user) return { error: "generic" };
  const { data: orders, error } = await supabase.rpc("request_job_order", { p_job_id: jobId, p_tier: tier });
  const order = (orders as { order_id: string; tier: JobTier; previous_tier: JobTier | null }[] | null)?.[0];
  if (error || !order) return { error: error?.code === "22023" ? "upgrade" : "generic" };

  const s = stripe();
  const db = adminClient();
  if (!s || !db) return { pending: true };
  const { data: job } = await supabase
    .from("jobs")
    .select("title, org_id, locations(name, country)")
    .eq("id", jobId)
    .single();
  const place = job?.locations as unknown as { name: string; country: string } | null;
  if (!job || !place) return { error: "generic" };

  try {
    const locale = await getLocale();
    const { currency, amount } = jobOrderPrice(place.country, order.tier, order.previous_tier);
    const unitAmount = toMinor(amount, currency);
    const customer = await orgCustomer(s, job.org_id, user.email ?? null, locale);
    const base = `${SITE_URL}${localePath(locale)}/business/jobs/${jobId}`;
    const t = await getTranslations("Billing");
    const tj = await getTranslations("BusinessJobs");
    const pkg = (tier: JobTier) => tj(`packages.${tier}.name`);
    const name = order.previous_tier
      ? t("jobUpgradeLine", { from: pkg(order.previous_tier), to: pkg(order.tier), title: job.title })
      : t("jobLine", { tier: pkg(order.tier), title: job.title });
    const meta = { job_order_id: order.order_id, job_id: jobId, kind: "job" };
    const session = await s.checkout.sessions.create({
      mode: "payment",
      customer,
      line_items: [{ quantity: 1, price_data: { currency, unit_amount: unitAmount, product_data: { name: name.slice(0, 250) } } }],
      metadata: meta,
      payment_intent_data: { metadata: meta, description: `${name} – ${place.name}`.slice(0, 1000) },
      invoice_creation: { enabled: true, invoice_data: { metadata: meta } },
      client_reference_id: order.order_id,
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      customer_update: { name: "auto", address: "auto" },
      locale: locale === "hu" ? "hu" : "en",
      success_url: `${base}?checkout=success`,
      cancel_url: `${base}?checkout=cancelled`,
    });
    await db.rpc("stripe_job_checkout_started", {
      p_order_id: order.order_id,
      p_session_id: session.id,
      p_amount: unitAmount,
      p_currency: currency,
    });
    return session.url ? { url: session.url } : { error: "generic" };
  } catch (e) {
    console.error("payForJob", e);
    return { error: "generic" };
  }
}
