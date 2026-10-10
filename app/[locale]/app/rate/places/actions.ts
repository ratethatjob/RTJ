"use server";

import { getLocale } from "next-intl/server";
import { getUser } from "@/lib/auth";
import type { Category } from "@/lib/data/types";
import { autocomplete, type PlaceDetails, placeDetails, placesConfigured } from "@/lib/places";
import { adminClient } from "@/lib/supabase/admin";

const CATEGORIES: Category[] = ["restaurant", "retail", "warehouse", "factory", "office"];

export type Suggestion = { placeId: string; main: string; secondary: string; locationId: string | null };

/** Google suggestions, marked when the place is already on RateThatJob. */
export async function searchPlaces(
  input: string,
  sessionToken: string,
): Promise<{ suggestions?: Suggestion[]; error?: "signin" | "generic" }> {
  const text = input.trim().slice(0, 100);
  if (!placesConfigured || text.length < 3) return { suggestions: [] };
  const { supabase, user } = await getUser();
  if (!user) return { error: "signin" };
  try {
    const found = await autocomplete(text, await getLocale(), sessionToken);
    const { data } = found.length
      ? await supabase.rpc("locations_by_place", { p_place_ids: found.map((f) => f.placeId) })
      : { data: [] };
    const known = new Map(((data ?? []) as { place_id: string; location_id: string }[]).map((r) => [r.place_id, r.location_id]));
    return { suggestions: found.map((f) => ({ ...f, locationId: known.get(f.placeId) ?? null })) };
  } catch (e) {
    console.error("searchPlaces", e);
    return { error: "generic" };
  }
}

/** Picks a suggestion: an existing workplace, or the place details to confirm. */
export async function choosePlace(
  placeId: string,
  sessionToken: string,
): Promise<{ locationId?: string; place?: PlaceDetails; error?: "generic" }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "generic" };
  const { data } = await supabase.rpc("locations_by_place", { p_place_ids: [placeId] });
  const existing = (data as { location_id: string }[] | null)?.[0]?.location_id;
  if (existing) return { locationId: existing };
  const place = await placeDetails(placeId, await getLocale(), sessionToken);
  return place ? { place } : { error: "generic" };
}

/** Creates the workplace from Google's data (fetched again here, never from the client). */
export async function confirmPlace(
  placeId: string,
  category: string,
): Promise<{ locationId?: string; error?: "invalid" | "limit" | "generic" }> {
  if (!CATEGORIES.includes(category as Category)) return { error: "invalid" };
  const { user } = await getUser();
  const db = adminClient();
  if (!user || !db) return { error: "generic" };
  const place = await placeDetails(placeId, await getLocale());
  if (!place || !place.name || !place.address || !place.city || !place.country) return { error: "invalid" };
  const { data, error } = await db.rpc("workplace_from_place", {
    p_user_id: user.id,
    p_place_id: place.placeId,
    p_name: place.name,
    p_address: place.address,
    p_city: place.city,
    p_country: place.country,
    p_category: category,
    p_lat: place.lat,
    p_lng: place.lng,
  });
  if (error) return { error: error.code === "54000" ? "limit" : error.code === "22023" ? "invalid" : "generic" };
  return { locationId: data as string };
}
