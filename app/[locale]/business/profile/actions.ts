"use server";

import { revalidateTag } from "next/cache";
import { getUser } from "@/lib/auth";

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
  revalidateTag(`profile:${locationId}`, "max");
  return { ok: true };
}
