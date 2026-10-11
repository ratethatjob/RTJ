import { adminClient } from "@/lib/supabase/admin";

/** Counts one map API call (daily totals in places_usage, monthly on the admin Metrics tab)
 *  and logs it. Never throws: counting must not break a search. */
export async function recordPlacesCall(provider: "google" | "osm", kind: "autocomplete" | "details") {
  console.log(JSON.stringify({ event: "places_call", provider, kind }));
  try {
    await adminClient()?.rpc("record_places_call", { p_provider: provider, p_kind: kind });
  } catch {}
}
