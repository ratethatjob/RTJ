"use server";

import { updateTag } from "next/cache";
import { getUser } from "@/lib/auth";
import { expireWorkplaces } from "@/lib/cache";
import { isCategory } from "@/lib/categories";
import { geocodeLocation } from "@/lib/geocode";

export type ProfileInput = { about: string; website: string; benefits: string; photos: string[] };

export async function saveProfile(
  locationId: string,
  input: ProfileInput,
): Promise<{ ok?: true; error?: "invalid" | "generic" }> {
  const about = input.about.trim();
  let website = input.website.trim();
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
  const benefits = input.benefits
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean);
  const photos = input.photos.filter((p) => p.startsWith(`${locationId}/`));
  if (
    about.length > 2000 ||
    (website && (!/^https?:\/\/\S+$/i.test(website) || website.length > 300)) ||
    benefits.length > 12 ||
    benefits.some((b) => b.length > 80) ||
    photos.length > 6
  ) {
    return { error: "invalid" };
  }
  const { supabase, user } = await getUser();
  if (!user) return { error: "generic" };
  const { error } = await supabase.from("location_profiles").upsert(
    {
      location_id: locationId,
      about: about || null,
      website: website || null,
      benefits,
      photos,
      updated_by: user.id,
    },
    { onConflict: "location_id" },
  );
  if (error) return { error: "generic" };
  updateTag(`profile:${locationId}`);
  updateTag("profiles");
  return { ok: true };
}

/** The employer's own choice of main category for its location (refused when an admin set it). */
export async function setOwnCategory(locationId: string, category: string): Promise<{ ok?: true; error?: true }> {
  if (!isCategory(category)) return { error: true };
  const { supabase } = await getUser();
  const { error } = await supabase.rpc("set_my_location_category", { p_location_id: locationId, p_category: category });
  if (error) return { error: true };
  expireWorkplaces();
  return { ok: true };
}

/** The employer corrects its location's name, address and city (not a field an admin edited);
 *  a new address is geocoded again. */
export async function updateOwnLocation(
  locationId: string,
  input: { name: string; address: string; city: string },
): Promise<{ ok?: true; error?: "invalid" | "locked" | "generic" }> {
  const name = input.name.trim();
  const address = input.address.trim();
  const city = input.city.trim();
  if (name.length < 2 || name.length > 100 || address.length < 2 || address.length > 150 || city.length < 2 || city.length > 80) {
    return { error: "invalid" };
  }
  const { supabase } = await getUser();
  const { data: moved, error } = await supabase.rpc("update_my_location", {
    p_location_id: locationId,
    p_name: name,
    p_address: address,
    p_city: city,
  });
  if (error) return { error: error.message === "locked" ? "locked" : error.code === "22023" ? "invalid" : "generic" };
  if (moved) await geocodeLocation(locationId);
  expireWorkplaces();
  return { ok: true };
}
