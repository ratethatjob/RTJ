"use server";

import { after } from "next/server";
import { getLocale } from "next-intl/server";
import { getUser } from "@/lib/auth";
import { getPathname } from "@/i18n/navigation";
import { getLocationById } from "@/lib/data";
import { locationPath } from "@/lib/format";
import { parseReview, type ReviewInput } from "@/lib/review-input";
import { processNewReview } from "@/lib/translation-jobs";
import { createManualWorkplace, createPlaceWorkplace, parsePendingWorkplace } from "@/lib/workplaces";

export async function shuffleName(): Promise<string | null> {
  const { supabase, user } = await getUser();
  if (!user) return null;
  const { data } = await supabase.rpc("shuffle_generated_name");
  return (data as string | null) ?? null;
}

export async function saveDisplayName(
  mode: "generated" | "username",
  username: string,
): Promise<{ error?: "invalid" | "taken" | "generic" }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "generic" };
  const name = username.trim().toLowerCase();
  if (mode === "username" && !/^[a-z0-9_]{3,30}$/.test(name)) return { error: "invalid" };

  const { error } = await supabase
    .from("profiles")
    .update({
      display_mode: mode,
      ...(mode === "username" && { username: name }),
      name_confirmed_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (error) return { error: error.code === "23505" ? "taken" : "generic" };
  return {};
}

export async function submitReview(
  input: ReviewInput,
  inviteToken?: string,
  workplace?: unknown,
  jobAlerts?: boolean,
): Promise<{
  id?: string;
  /** The workplace's public page (new workplaces get theirs only now). */
  href?: string;
  nameConfirmed?: boolean;
  error?: "required" | "dates" | "invalid" | "limit" | "generic";
}> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "generic" };

  // Picked or typed before signing in: check the review first, then create the workplace.
  const pending = workplace === undefined ? null : parsePendingWorkplace(workplace);
  if (workplace !== undefined && !pending) return { error: "invalid" };
  if (pending) {
    const check = parseReview({ ...input, locationId: "00000000-0000-4000-8000-000000000000" });
    if ("error" in check) return { error: check.error };
    const created =
      pending.kind === "manual"
        ? await createManualWorkplace(supabase, pending)
        : await createPlaceWorkplace(user.id, pending, await getLocale());
    if (created.error || !created.id) return { error: created.error ?? "generic" };
    input = { ...input, locationId: created.id };
  }
  // Consent given on the sign-in step (only ever switched on here; off on the account page).
  if (jobAlerts === true) await supabase.from("profiles").update({ job_alerts: true }).eq("user_id", user.id);

  const parsed = parseReview(input);
  if ("error" in parsed) return { error: parsed.error };
  const location = await getLocationById(input.locationId);
  if (!location) return { error: "generic" };

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      ...parsed.row,
      user_id: user.id,
      original_language: parsed.row.body ? await getLocale() : null,
      status: "pending_moderation",
    })
    .select("id")
    .single();
  if (error) return { error: "generic" };
  // Marks the review as invited; an invalid or reused token is simply ignored.
  if (inviteToken) {
    await supabase.rpc("attach_invite", { p_review_id: data.id, p_token: inviteToken });
  }
  if (parsed.row.body) after(() => processNewReview(data.id));
  const { data: profile } = await supabase.from("profiles").select("name_confirmed_at").eq("user_id", user.id).single();
  return {
    id: data.id,
    href: getPathname({ href: locationPath(location), locale: await getLocale() }),
    nameConfirmed: Boolean(profile?.name_confirmed_at),
  };
}

/** Employer claim flow: a hand-entered workplace, created right away. */
export async function createWorkplace(form: {
  company: string;
  address: string;
  city: string;
  country: string;
  category: string;
}): Promise<{ id?: string; error?: "invalid" | "limit" | "generic" }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "generic" };
  const pending = parsePendingWorkplace({ ...form, kind: "manual" });
  if (!pending || pending.kind !== "manual") return { error: "invalid" };
  return createManualWorkplace(supabase, pending);
}

/** Account page: switch the job alerts email consent. */
export async function setJobAlerts(on: boolean): Promise<{ error?: "generic" }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "generic" };
  const { error } = await supabase.from("profiles").update({ job_alerts: on }).eq("user_id", user.id);
  return error ? { error: "generic" } : {};
}
