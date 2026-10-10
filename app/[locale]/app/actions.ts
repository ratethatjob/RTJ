"use server";

import { getLocale } from "next-intl/server";
import { getUser } from "@/lib/auth";
import { getLocationById } from "@/lib/data";
import { parseReview, type ReviewInput } from "@/lib/review-input";

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
  return { id: data.id };
}
