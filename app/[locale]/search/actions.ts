"use server";

import { getLocale } from "next-intl/server";
import { expireWorkplaces } from "@/lib/cache";
import { type PlaceCandidate, ensureLocationFromPlace } from "@/lib/place-ensure";
import { locationHref } from "@/lib/place-search";

// Main search (/search): opening a picked map place – it becomes a workplace page on the click
// (or opens the one we already have for it; ensureLocationFromPlace in lib/place-ensure.ts). The
// map results themselves are found on the server (findMapPlaces in lib/place-search.ts), with the
// same session token as this details call.

/** The picked map place's workplace page, or the close workplaces to ask about. */
export async function openMapPlace(
  placeId: string,
  sessionToken?: string,
  choice?: { confirm?: string; force?: boolean },
): Promise<{ href?: string; candidates?: PlaceCandidate[]; error?: "limit" | "generic" }> {
  const result = await ensureLocationFromPlace(placeId, {
    via: "search",
    locale: await getLocale(),
    sessionToken,
    confirm: choice?.confirm,
    force: choice?.force,
  });
  if ("candidates" in result) return { candidates: result.candidates };
  if ("error" in result) return { error: result.error === "limit" ? "limit" : "generic" };
  if (result.created) expireWorkplaces();
  const href = await locationHref(result.locationId);
  return href ? { href } : { error: "generic" };
}
