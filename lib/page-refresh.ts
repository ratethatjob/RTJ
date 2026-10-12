import { revalidateTag } from "next/cache";
import { adminClient } from "@/lib/supabase/admin";

// Reviews that go live (or come down) inside the database queue their location in
// page_refresh_queue (migration 20261012180000_page_refresh.sql) and ping /api/revalidate. This
// takes the queue and expires the cached pages: every workplace list ("locations": city hubs,
// search, near you, company pages), and the location's own page, reviews and company. Expired with
// { expire: 0 } so the next visitor gets the fresh page, not the old one once more.

export async function refreshQueuedPages(): Promise<{ locations: number }> {
  const db = adminClient();
  if (!db) return { locations: 0 };
  const { data, error } = await db.rpc("take_page_refresh", { p_limit: 500 });
  if (error) throw error;
  const rows = (data ?? []) as { location_id: string; company_slug: string | null; location_slug: string | null }[];
  if (!rows.length) return { locations: 0 };
  const now = { expire: 0 };
  revalidateTag("locations", now);
  for (const r of rows) {
    revalidateTag(`reviews:${r.location_id}`, now);
    if (r.company_slug) {
      revalidateTag(`company:${r.company_slug}`, now);
      if (r.location_slug) revalidateTag(`location:${r.company_slug}/${r.location_slug}`, now);
    }
  }
  return { locations: rows.length };
}
