"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

/** Follow a workplace. Checked in the browser so the page stays cacheable. */
export function FollowButton({
  locationId,
  followLabel,
  followingLabel,
  className,
}: {
  locationId: string;
  followLabel: string;
  followingLabel: string;
  className: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) return;
        supabase
          .from("follows")
          .select("active")
          .eq("location_id", locationId)
          .maybeSingle()
          .then(({ data: row }) => setFollowing(Boolean(row?.active)));
      });
    } catch {}
  }, [locationId]);

  async function toggle() {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) return router.push({ pathname: "/app/sign-in", query: { next: pathname } });
    setBusy(true);
    const { data: state, error } = await supabase.rpc("toggle_follow", { p_location_id: locationId });
    setBusy(false);
    if (!error) setFollowing(Boolean(state));
  }

  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={following} className={className}>
      {following ? `✓ ${followingLabel}` : followLabel}
    </button>
  );
}
