import { cache } from "react";
import { getUser } from "@/lib/auth";

/** The signed-in person's first employer membership (any role), for "My account". */
export const getMembership = cache(async (): Promise<{ orgName: string } | null> => {
  const { supabase, user } = await getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("org_members")
    .select("orgs(name)")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1);
  const org = data?.[0]?.orgs as unknown as { name: string } | null;
  return org ? { orgName: org.name } : null;
});
