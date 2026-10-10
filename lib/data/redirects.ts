import { cacheLife, cacheTag } from "next/cache";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import { publicClient } from "./supabase";

/**
 * Where an old company/location URL moved to (slug_redirects), or null.
 * "/old-company" also covers "/old-company/<location>/...".
 */
export async function findRedirect(company: string, location?: string, rest = ""): Promise<string | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("redirects");
  if (!supabaseUrl || !supabaseKey) return null;
  const companyPath = `/${company}`;
  const locationPath = location ? `${companyPath}/${location}` : null;
  const { data, error } = await publicClient()
    .from("slug_redirects")
    .select("old_path, new_path")
    .in("old_path", locationPath ? [locationPath, companyPath] : [companyPath]);
  if (error) throw error;
  const byPath = new Map(data.map((r) => [r.old_path, r.new_path as string]));
  const current = `${locationPath ?? companyPath}${rest}`;
  let target: string | null = null;
  if (locationPath && byPath.has(locationPath)) target = `${byPath.get(locationPath)}${rest}`;
  else if (byPath.has(companyPath)) target = `${byPath.get(companyPath)}${location ? `/${location}` : ""}${rest}`;
  return target && target !== current ? target : null;
}
