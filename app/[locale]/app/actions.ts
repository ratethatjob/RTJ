"use server";

import { after } from "next/server";
import { getLocale } from "next-intl/server";
import { getUser } from "@/lib/auth";
import { getLocationById } from "@/lib/data";
import { parseReview, type ReviewInput } from "@/lib/review-input";
import { translateReview } from "@/lib/translation-jobs";

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
): Promise<{ id?: string; error?: "required" | "dates" | "generic" }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "generic" };

  const parsed = parseReview(input);
  if ("error" in parsed) return { error: parsed.error };
  if (!(await getLocationById(input.locationId))) return { error: "generic" };

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
  if (parsed.row.body) after(() => translateReview(data.id));
  return { id: data.id };
}

const CATEGORIES = ["restaurant", "retail", "warehouse", "factory", "office"] as const;
const COUNTRIES = ["HU", "US", "AT", "DE", "SK", "RO", "GB"] as const;

export async function createWorkplace(form: {
  company: string;
  address: string;
  city: string;
  country: string;
  category: string;
}): Promise<{ id?: string; error?: "invalid" | "limit" | "generic" }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "generic" };
  const company = form.company.trim();
  const address = form.address.trim();
  const city = form.city.trim();
  if (
    company.length < 2 ||
    address.length < 2 ||
    city.length < 2 ||
    !COUNTRIES.includes(form.country as (typeof COUNTRIES)[number]) ||
    !CATEGORIES.includes(form.category as (typeof CATEGORIES)[number])
  ) {
    return { error: "invalid" };
  }
  const { data, error } = await supabase.rpc("create_workplace", {
    p_company: company,
    p_address: address,
    p_city: city,
    p_country: form.country,
    p_category: form.category,
  });
  if (error) return { error: error.code === "54000" ? "limit" : error.code === "22023" ? "invalid" : "generic" };
  return { id: data as string };
}
