import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PlanBadge } from "@/components/business/plan-badge";
import { getBusiness } from "@/lib/business";

export const instant = false;

const ROLES = ["owner", "hr", "location_manager"] as const;

export default async function LocationsPage({ params }: PageProps<"/[locale]/business/locations">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, org } = await getBusiness(locale, "/business/locations");
  if (!org) return null;
  const t = await getTranslations("Business");

  const { data: members } = await supabase.from("org_members").select("role").eq("org_id", org.id);
  const count = (role: string) => (members ?? []).filter((m) => m.role === role).length;
  const proCount = org.locations.filter((l) => l.plan === "pro").length;
  const bold = (chunks: React.ReactNode) => <b className="font-black text-paper">{chunks}</b>;

  return (
    <main>
      <h1 className="text-4xl font-black tracking-brand lg:text-5xl">{t("locationsTitle")}</h1>
      <p className="mt-1 text-slate">{t("locationsBody")}</p>

      <section className="mt-6 overflow-x-auto rounded-3xl bg-white">
        <table className="w-full min-w-[560px] text-left">
          <thead className="text-sm uppercase tracking-tagline text-slate">
            <tr className="border-b border-[#E8E6E1]">
              <th className="px-6 py-4 font-black">{t("table.location")}</th>
              <th className="px-6 py-4 font-black">{t("table.plan")}</th>
              <th className="px-6 py-4 text-right font-black">{t("price")}</th>
            </tr>
          </thead>
          <tbody>
            {org.locations.map((l) => (
              <tr key={l.id} className="border-b border-[#E8E6E1] last:border-0">
                <td className="px-6 py-4">
                  <span className="block font-black">{l.address}</span>
                  <span className="text-slate">
                    {l.city}
                    {l.legalEntityName && ` · ${l.legalEntityName}`}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <PlanBadge plan={l.plan} label={t(`plans.${l.plan}`)} />
                </td>
                <td className="px-6 py-4 text-right">
                  <button disabled title={t("comingSoon")} className="rounded-xl border-2 border-ink px-4 py-2 font-black opacity-50">
                    {t("upgrade")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section id="team" className="rounded-3xl bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-black tracking-brand">{t("teamTitle")}</h2>
            <Link href="/business/team" className="rounded-xl border-2 border-ink px-4 py-2 font-black">
              {t("inviteMember")}
            </Link>
          </div>
          <ul className="mt-4 flex flex-col gap-3">
            {ROLES.map((r) => (
              <li key={r} className="flex items-start justify-between rounded-2xl bg-paper p-4">
                <span>
                  <span className="block text-lg font-black">{t(`roles.${r}`)}</span>
                  <span className="text-slate">{t(`roleDescriptions.${r}`)}</span>
                </span>
                <span className="font-black">{count(r)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="plan" className="rounded-3xl bg-ink p-6 text-paper">
          <h2 className="text-2xl font-black tracking-brand">{t("planTitle")}</h2>
          <div className="mt-4 grid grid-cols-2 rounded-2xl bg-white/10 p-1.5 font-black">
            <span className="rounded-xl py-3 text-center">{t("monthly")}</span>
            <span className="rounded-xl bg-signal py-3 text-center text-ink">{t("yearly")}</span>
          </div>
          <p className="mt-4 text-mist">{t.rich("proIncludes", { b: bold })}</p>
          <p className="mt-2 text-mist">{t.rich("chains", { b: bold })}</p>
          <div className="mt-4 border-t border-white/15 pt-4">
            <p className="text-sm text-mist">
              {proCount} Pro · {t("billingSoon")}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
