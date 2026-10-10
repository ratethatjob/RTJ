import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TeamManager } from "@/components/business/team-manager";
import { getPathname } from "@/i18n/navigation";
import { getBusiness } from "@/lib/business";

export const instant = false;

type Role = "owner" | "hr" | "location_manager";

export default async function TeamPage({ params }: PageProps<"/[locale]/business/team">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, user, org } = await getBusiness(locale, "/business/team");
  if (!org) return null;
  const t = await getTranslations("Team");
  const isOwner = org.role === "owner";

  const [{ data: team }, { data: own }, { data: invites }] = await Promise.all([
    org.role === "location_manager"
      ? Promise.resolve({ data: null })
      : supabase.rpc("org_team", { p_org_id: org.id }),
    supabase.from("org_members").select("id, user_id, role, location_ids").eq("user_id", user.id),
    isOwner
      ? supabase
          .from("org_member_invites")
          .select("id, role, location_ids, token, expires_at")
          .eq("org_id", org.id)
          .is("used_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const host = (await headers()).get("host");
  const origin = `${host?.startsWith("localhost") ? "http" : "https"}://${host}`;
  const joinBase = `${origin}${getPathname({ href: "/business/join", locale })}`;

  type TeamRow = { id: string; user_id: string; role: Role; location_ids: string[]; email: string | null };
  const members = ((team as TeamRow[] | null) ?? (own as TeamRow[] | null)?.map((m) => ({ ...m, email: user.email ?? user.phone ?? null })) ?? []).map(
    (m) => ({ id: m.id, userId: m.user_id, role: m.role, locationIds: m.location_ids, email: m.email }),
  );

  return (
    <main className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-4xl font-black tracking-brand lg:text-5xl">{t("title")}</h1>
        <p className="mt-1 text-slate">{t("body")}</p>
      </div>
      <TeamManager
        orgId={org.id}
        meId={user.id}
        isOwner={isOwner}
        members={members}
        invites={(invites ?? []).map((i) => ({
          id: i.id,
          role: i.role as Role,
          locationIds: i.location_ids,
          url: `${joinBase}/${i.token}`,
          expiresAt: i.expires_at,
        }))}
        locations={org.locations.map((l) => ({ id: l.id, name: l.name, address: l.address }))}
        joinBase={joinBase}
      />
    </main>
  );
}
