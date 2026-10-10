import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CopyLink } from "@/components/business/copy-link";
import { LocationSelect } from "@/components/business/location-select";
import { getPathname } from "@/i18n/navigation";
import { getBusiness, pickLocation } from "@/lib/business";

export const instant = false;

export default async function InviteTeamPage({ params, searchParams }: PageProps<"/[locale]/business/invite">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const { supabase, org } = await getBusiness(locale, "/business/invite");
  if (!org || org.locations.length === 0) return null;
  const t = await getTranslations("Business");

  const location = pickLocation(org.locations, query.location) ?? org.locations[0];
  const [{ data: token }, { data: stats }] = await Promise.all([
    supabase.rpc("location_invite_token", { p_location_id: location.id }),
    supabase.rpc("invite_batch_stats", { p_location_id: location.id }),
  ]);
  const host = (await headers()).get("host");
  const origin = `${host?.startsWith("localhost") ? "http" : "https"}://${host}`;
  const url = token ? `${origin}${getPathname({ href: `/r/${token}`, locale })}` : null;
  const s = (stats as { invites_sent: number; reviews_received: number | null }[] | null)?.[0];

  return (
    <main className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div>
        <h1 className="text-4xl font-black tracking-brand lg:text-5xl">{t("inviteTitle")}</h1>
        <p className="mt-1 text-slate">{t("inviteBody")}</p>

        <section className="mt-6 rounded-3xl bg-white p-6">
          <h2 className="mb-3 text-sm font-black uppercase tracking-tagline text-slate">{t("step1")}</h2>
          <LocationSelect locations={org.locations} selected={location.id} allowAll={false} />
        </section>

        <section className="mt-4 rounded-3xl bg-white p-6">
          <h2 className="mb-3 text-sm font-black uppercase tracking-tagline text-slate">{t("step2")}</h2>
          <div className="rounded-2xl bg-paper p-5">
            <p className="mb-3">
              <span className="font-black">{t("shareable")}</span>{" "}
              <span className="text-slate">· {t("shareableHint")}</span>
            </p>
            {url ? <CopyLink url={url} /> : <p className="text-slate">{t("error")}</p>}
          </div>
          <p className="mt-4 text-slate">{t("emailSmsSoon")}</p>
        </section>
      </div>

      <aside className="flex flex-col gap-4">
        <section className="rounded-3xl bg-ink p-6 text-paper">
          <h2 className="text-sm font-black uppercase tracking-tagline text-mist">{t("thisLocation")}</h2>
          <dl className="mt-3 flex flex-col gap-2">
            <div className="flex justify-between text-lg">
              <dt>{t("invitesSent")}</dt>
              <dd className="font-black">{s?.invites_sent ?? 0}</dd>
            </div>
            <div className="flex justify-between text-lg">
              <dt>{t("reviewsReceived")}</dt>
              <dd className="font-black">{s?.reviews_received ?? "< 5"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-mist">{t("countsNote")}</p>
        </section>
        <section className="rounded-3xl bg-white p-6">
          <h2 className="text-xl font-black">{t("whyTitle")}</h2>
          <p className="mt-2 text-slate">{t("whyBody")}</p>
        </section>
      </aside>
    </main>
  );
}
