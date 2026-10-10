import { cache } from "react";
import { requireUser } from "@/lib/auth";
import { toLocation } from "@/lib/data/supabase";
import type { LocationSummary } from "@/lib/data/types";

export type OrgRole = "owner" | "hr" | "location_manager";

export type BusinessLocation = LocationSummary & {
  trend: number | null;
  plan: "free" | "pro";
};

// Everything the employer dashboard needs about the signed-in member's org.
const loadBusiness = cache(async (locale: string, path: string) => {
  const { supabase, user } = await requireUser(locale, path);

  const { data: members } = await supabase
    .from("org_members")
    .select("id, org_id, role, location_ids, orgs(name)")
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

  const [{ data: scores }, { data: plans }] = await Promise.all([
    supabase.from("location_scores").select("location_id, overall_trend").in("location_id", ids),
    supabase.from("location_plans").select("location_id, plan").in("location_id", ids),
  ]);
  const trend = new Map((scores ?? []).map((s) => [s.location_id, s.overall_trend]));
  const plan = new Map((plans ?? []).map((p) => [p.location_id, p.plan]));

  const org = member.orgs as unknown as { name: string } | null;
  return {
    supabase,
    user,
    org: {
      id: member.org_id as string,
      name: org?.name ?? "",
      role: member.role as OrgRole,
      locations: locations.map<BusinessLocation>((l) => ({
        ...l,
        trend: trend.get(l.id) == null ? null : Number(trend.get(l.id)),
        plan: (plan.get(l.id) as "free" | "pro") ?? "free",
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
