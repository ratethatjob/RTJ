import { cache } from "react";
import { requireUser } from "@/lib/auth";
import { toLocation } from "@/lib/data/supabase";
import type { LocationSummary } from "@/lib/data/types";

export type OrgRole = "owner" | "hr" | "location_manager";

/** "trial": in the free 30-day trial; "pro": paid; "free": no Pro (never had it, or it ended). */
export type PlanState = "trial" | "pro" | "free";

export type BusinessLocation = LocationSummary & {
  trend: number | null;
  plan: PlanState;
  /** Pro features (Index embeds, early warnings, statistics) are on. */
  pro: boolean;
  trialEndsAt: string | null;
  paidUntil: string | null;
  trialUsed: boolean;
  /** Activation requested and waiting for payment. */
  pendingOrder: "month" | "year" | null;
  /** The location's Stripe subscription, if any. */
  subscription: { status: string; periodEnd: string | null; cancelAtPeriodEnd: boolean; interval: string | null } | null;
};

const DAY = 24 * 3600 * 1000;

/** Whole days left until `iso` (at least 1 while it is in the future). */
export function daysLeft(iso: string, now = Date.now()) {
  return Math.max(1, Math.ceil((Date.parse(iso) - now) / DAY));
}

// Everything the employer dashboard needs about the signed-in member's org.
const loadBusiness = cache(async (locale: string, path: string) => {
  const { supabase, user } = await requireUser(locale, path);

  const { data: members } = await supabase
    .from("org_members")
    .select("id, org_id, role, location_ids, orgs(name, stripe_customer_id)")
    .eq("user_id", user.id)
    .order("created_at");
  const member = members?.[0];
  if (!member) return { supabase, user, org: null };

  const { data: companies } = await supabase
    .from("companies")
    .select("slug")
    .eq("owner_org_id", member.org_id);
  const slugs = (companies ?? []).map((c) => c.slug);

  const { data: rows } = slugs.length
    ? await supabase.from("public_locations").select("*").in("company_slug", slugs).order("name")
    : { data: [] };
  let locations = (rows ?? []).map(toLocation);
  if (member.role === "location_manager") {
    locations = locations.filter((l) => member.location_ids.includes(l.id));
  }
  const ids = locations.map((l) => l.id);

  const [{ data: scores }, { data: plans }, { data: orders }] = await Promise.all([
    supabase.from("location_scores").select("location_id, overall_trend").in("location_id", ids),
    supabase
      .from("location_plans")
      .select(
        "location_id, trial_started_at, trial_ends_at, paid_until, billing_interval, stripe_status, stripe_period_end, cancel_at_period_end",
      )
      .in("location_id", ids),
    supabase.from("plan_orders").select("location_id, billing_interval").eq("status", "pending").in("location_id", ids),
  ]);
  const trend = new Map((scores ?? []).map((s) => [s.location_id, s.overall_trend]));
  const plan = new Map((plans ?? []).map((p) => [p.location_id, p]));
  const pending = new Map((orders ?? []).map((o) => [o.location_id, o.billing_interval as "month" | "year"]));
  const now = Date.now();
  const future = (iso: string | null | undefined) => Boolean(iso && Date.parse(iso) > now);

  const org = member.orgs as unknown as { name: string; stripe_customer_id: string | null } | null;
  return {
    supabase,
    user,
    org: {
      id: member.org_id as string,
      name: org?.name ?? "",
      role: member.role as OrgRole,
      /** Has paid by card before: invoices and card in the Stripe Customer Portal. */
      billingAccount: Boolean(org?.stripe_customer_id),
      locations: locations.map<BusinessLocation>((l) => ({
        ...l,
        trend: trend.get(l.id) == null ? null : Number(trend.get(l.id)),
        ...(() => {
          const p = plan.get(l.id);
          const paid = future(p?.paid_until) || p?.stripe_status === "active";
          const trial = future(p?.trial_ends_at) || p?.stripe_status === "trialing";
          return {
            plan: (paid ? "pro" : trial ? "trial" : "free") as PlanState,
            pro: paid || trial,
            trialEndsAt: p?.trial_ends_at ?? null,
            paidUntil: p?.paid_until ?? null,
            trialUsed: Boolean(p?.trial_started_at),
            pendingOrder: pending.get(l.id) ?? null,
            subscription: p?.stripe_status
              ? {
                  status: p.stripe_status,
                  periodEnd: p.stripe_period_end ?? null,
                  cancelAtPeriodEnd: Boolean(p.cancel_at_period_end),
                  interval: p.billing_interval ?? null,
                }
              : null,
          };
        })(),
      })),
    },
  };
});

export function getBusiness(locale: string, path: string) {
  return loadBusiness(locale, path);
}

/** Picks the location from ?location=, or null for "all locations". */
export function pickLocation<T extends { id: string }>(locations: T[], value: unknown) {
  return typeof value === "string" ? (locations.find((l) => l.id === value) ?? null) : null;
}
