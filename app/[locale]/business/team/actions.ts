"use server";

import { getUser } from "@/lib/auth";

type Role = "owner" | "hr" | "location_manager";
const ROLES: Role[] = ["owner", "hr", "location_manager"];
type Result = { ok?: true; token?: string; error?: "invalid" | "lastOwner" | "otherOrg" | "generic" };

function valid(role: string, locationIds: string[]): role is Role {
  return ROLES.includes(role as Role) && (role !== "location_manager" || locationIds.length > 0);
}

export async function createMemberInvite(orgId: string, role: string, locationIds: string[]): Promise<Result> {
  if (!valid(role, locationIds)) return { error: "invalid" };
  const { supabase, user } = await getUser();
  if (!user) return { error: "generic" };
  const { data, error } = await supabase
    .from("org_member_invites")
    .insert({
      org_id: orgId,
      role,
      location_ids: role === "location_manager" ? locationIds : [],
      created_by: user.id,
    })
    .select("token")
    .single();
  return error ? { error: "generic" } : { ok: true, token: data.token };
}

export async function revokeMemberInvite(id: string): Promise<Result> {
  const { supabase } = await getUser();
  const { error } = await supabase.from("org_member_invites").delete().eq("id", id);
  return error ? { error: "generic" } : { ok: true };
}

async function ownerCount(supabase: Awaited<ReturnType<typeof getUser>>["supabase"], orgId: string) {
  const { count } = await supabase
    .from("org_members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("role", "owner");
  return count ?? 0;
}

export async function updateMember(
  orgId: string,
  memberId: string,
  role: string,
  locationIds: string[],
): Promise<Result> {
  if (!valid(role, locationIds)) return { error: "invalid" };
  const { supabase } = await getUser();
  const { data: member } = await supabase.from("org_members").select("role").eq("id", memberId).single();
  if (member?.role === "owner" && role !== "owner" && (await ownerCount(supabase, orgId)) < 2) {
    return { error: "lastOwner" };
  }
  const { data, error } = await supabase
    .from("org_members")
    .update({ role, location_ids: role === "location_manager" ? locationIds : [] })
    .eq("id", memberId)
    .eq("org_id", orgId)
    .select("id");
  return error || !data.length ? { error: "generic" } : { ok: true };
}

export async function removeMember(orgId: string, memberId: string): Promise<Result> {
  const { supabase } = await getUser();
  const { data: member } = await supabase.from("org_members").select("role").eq("id", memberId).single();
  if (member?.role === "owner" && (await ownerCount(supabase, orgId)) < 2) return { error: "lastOwner" };
  const { data, error } = await supabase
    .from("org_members")
    .delete()
    .eq("id", memberId)
    .eq("org_id", orgId)
    .select("id");
  return error || !data.length ? { error: "generic" } : { ok: true };
}

export async function acceptMemberInvite(token: string): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "generic" };
  const { error } = await supabase.rpc("accept_member_invite", { p_token: token });
  if (!error) return { ok: true };
  return { error: error.code === "23505" ? "otherOrg" : error.code === "22023" ? "invalid" : "generic" };
}
