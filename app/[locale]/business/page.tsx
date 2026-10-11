import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { LocationSelect } from "@/components/business/location-select";
import { PendingClaims } from "@/components/business/pending-claims";
import { PlanBadge } from "@/components/business/plan-badge";
import { TrialBanner } from "@/components/business/trial-banner";
import { Link } from "@/i18n/navigation";
import { getBusiness, pickLocation } from "@/lib/business";

export const instant = false;

export default async function BusinessOverviewPage({ params, searchParams }: PageProps<"/[locale]/business">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const { supabase, user, org } = await getBusiness(locale, "/business");
  const t = await getTranslations("Business");
  const format = await getFormatter();

  if (!org) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-12">
        <h1 className="text-4xl font-black tracking-brand">{t("noOrgTitle")}</h1>
        <p className="mt-3 text-lg text-slate">{t("noOrgBody")}</p>
        <Link href="/business/claim" className="mt-6 inline-block rounded-2xl bg-ink px-7 py-4 text-lg font-black text-paper">
          {t("claimTitle")}
        </Link>
        <PendingClaims supabase={supabase} userId={user.id} />
      </main>
    );
  }

  const selected = pickLocation(org.locations, query.location);
  const locs = selected ? [selected] : org.locations;
  const rated = locs.filter((l) => l.scores);
  const total = rated.reduce((n, l) => n + l.scores!.reviewCount, 0);
  const verified = rated.reduce((n, l) => n + l.scores!.verifiedCount, 0);
  const weighted = (pick: (l: (typeof rated)[number]) => number | null) => {
    const pairs = rated
      .map((l) => [pick(l), l.scores!.reviewCount] as const)
      .filter(([v]) => v != null) as [number, number][];
    const w = pairs.reduce((n, [, c]) => n + c, 0);
    return w ? pairs.reduce((n, [v, c]) => n + v * c, 0) / w : null;
  };
  const avg = weighted((l) => l.scores!.overall);
  const trend = weighted((l) => l.trend);
  const replyRate = weighted((l) => l.scores!.replyRate);
  const replyDays = weighted((l) => l.scores!.avgReplyDays);

  const ids = locs.map((l) => l.id);
  const { count: awaiting } = ids.length
    ? await supabase
        .from("public_reviews")
        .select("id", { count: "exact", head: true })
        .in("location_id", ids)
        .is("reply_body", null)
    : { count: 0 };
  // Biggest category drop in the last 60 days (n >= 5 on both sides). Pro (trial or paid) only.
  const proIds = locs.filter((l) => l.pro).map((l) => l.id);
  const { data: warnings } = proIds.length
    ? await supabase.rpc("early_warnings", { p_location_ids: proIds })
    : { data: [] };
  const top = (warnings as { location_id: string; category: string; recent: number; baseline: number; delta: number }[] | null)?.[0];
  const warning = top && { ...top, location: locs.find((l) => l.id === top.location_id)! };
  const tc = await getTranslations("Stats.categories");

  const num = (v: number | null, digits = 1) =>
    v == null ? "–" : format.number(v, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const signed = (v: number) => `${v > 0 ? "▲" : v < 0 ? "▼" : "—"} ${num(Math.abs(v))}`;

  return (
    <main>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-brand lg:text-5xl">{t("overviewTitle")}</h1>
          <p className="mt-1 text-slate">
            {selected ? selected.address : t("allLocations")} · {t("last12")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LocationSelect locations={org.locations} selected={selected?.id ?? null} />
          <Link href="/business/invite" className="rounded-2xl bg-ink px-5 py-3 font-black text-paper">
            {t("inviteTeam")}
          </Link>
        </div>
      </header>

      <PendingClaims supabase={supabase} userId={user.id} />

      <div className="mt-6">
        <TrialBanner locations={org.locations} />
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("avgScore")} value={num(avg)}>
          {trend != null && <span className="font-black">{t("vsLastQuarter", { delta: signed(trend) })}</span>}
        </Stat>
        <Stat label={t("verifiedReviews")} value={String(verified)}>
          {t("ofTotal", { total })}
        </Stat>
        <Stat label={t("repliesToApplicants")} value={replyRate == null ? "–" : `${Math.round(replyRate)}%`}>
          {replyDays != null && t("avgDays", { days: num(replyDays) })}
        </Stat>
        <Stat label={t("awaitingReply")} value={String(awaiting ?? 0)}>
          {!!awaiting && (
            <Link href="/business/reviews" className="font-black text-ink underline underline-offset-4">
              {t("replyNow")}
            </Link>
          )}
        </Stat>
      </section>

      {warning && (
        <section className="mt-6 flex flex-col gap-4 rounded-3xl bg-ink p-6 text-paper sm:flex-row sm:items-center">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-signal text-2xl text-ink" aria-hidden="true">
            ⚠
          </span>
          <div className="flex-1">
            <p className="text-sm font-black uppercase tracking-tagline text-mist">{t("earlyWarning")}</p>
            <p className="text-xl font-black">{t("warningTitle", { location: warning.location.address })}</p>
            <p className="text-mist">
              {t("warningCategory", {
                category: tc(warning.category),
                delta: num(Math.abs(Number(warning.delta))),
                recent: num(Number(warning.recent)),
                baseline: num(Number(warning.baseline)),
              })}
            </p>
          </div>
          <Link
            href={{ pathname: "/business/stats", query: { location: warning.location_id } }}
            className="rounded-2xl bg-paper px-5 py-3 font-black text-ink"
          >
            {t("seeStats")}
          </Link>
        </section>
      )}

      <section className="mt-6 overflow-x-auto rounded-3xl bg-white">
        <table className="w-full min-w-[720px] text-left">
          <thead className="text-sm uppercase tracking-tagline text-slate">
            <tr className="border-b border-[#E8E6E1]">
              {(["location", "score", "trend", "reviews", "paidOnTime", "replies", "plan"] as const).map((k) => (
                <th key={k} className="px-6 py-4 font-black">
                  {t(`table.${k}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {org.locations.map((l) => (
              <tr key={l.id} className="border-b border-[#E8E6E1] last:border-0">
                <td className="px-6 py-4 font-black">{l.address}</td>
                <td className="px-6 py-4 font-black">{num(l.scores?.overall ?? null)}</td>
                <td className="px-6 py-4 font-black">{l.trend == null ? "–" : signed(l.trend)}</td>
                <td className="px-6 py-4">{l.scores?.reviewCount ?? 0}</td>
                <td className="px-6 py-4">{l.scores?.facts.paid_on_time == null ? "–" : `${l.scores.facts.paid_on_time}%`}</td>
                <td className="px-6 py-4">{l.scores?.replyRate == null ? "–" : `${l.scores.replyRate}%`}</td>
                <td className="px-6 py-4">
                  <PlanBadge plan={l.plan} label={t(`plans.${l.plan}`)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white p-6">
      <p className="font-black text-slate">{label}</p>
      <p className="mt-1 text-5xl font-black tracking-brand">{value}</p>
      <p className="mt-1 text-slate">{children}</p>
    </div>
  );
}
