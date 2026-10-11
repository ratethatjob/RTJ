"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Who is signed in and how they relate to the employer side, read in the browser so public
 *  pages stay static. `org`: first employer membership (any role); `pendingClaim`: an open
 *  access request. One request per page load, shared by the header, menu and cards. */
export type BusinessStatus = {
  signedIn: boolean;
  unread: number;
  org: { name: string } | null;
  pendingClaim: boolean;
  /** Display name (generated or username), for the avatar's initials. */
  name: string | null;
};

const SIGNED_OUT: BusinessStatus = { signedIn: false, unread: 0, org: null, pendingClaim: false, name: null };
let loading: Promise<BusinessStatus> | null = null;

function load(): Promise<BusinessStatus> {
  loading ??= (async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) return SIGNED_OUT;
      const [unread, members, claims, profile] = await Promise.all([
        supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
        supabase.from("org_members").select("orgs(name)").eq("user_id", uid).order("created_at").limit(1),
        supabase.from("claim_requests").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("status", "open"),
        supabase.from("profiles").select("display_mode, generated_name, username").eq("user_id", uid).maybeSingle(),
      ]);
      const p = profile.data;
      const name = (p?.display_mode === "username" ? p.username : p?.generated_name) || null;
      const org = (members.data?.[0]?.orgs as unknown as { name: string } | null) ?? null;
      return { signedIn: true, unread: unread.count ?? 0, org, pendingClaim: (claims.count ?? 0) > 0, name };
    } catch {
      return SIGNED_OUT;
    }
  })();
  return loading;
}

export function useBusinessStatus(): BusinessStatus | null {
  const [status, setStatus] = useState<BusinessStatus | null>(null);
  useEffect(() => {
    let live = true;
    load().then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, []);
  return status;
}
