import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { BarChart } from "@/components/business/bar-chart";
import { EarlySignals } from "@/components/business/early-signals";
import { LocationSelect } from "@/components/business/location-select";
import { ProGate } from "@/components/business/trial-banner";
import { getBusiness, pickLocation } from "@/lib/business";

export const instant = false;

type Month = { month: string; reviews: number; overall: number | null };
type Category = { category: string; recent: number | null; recent_n: number; baseline: number | null; baseline_n: number };

const CATEGORY_ORDER = ["overall", "manager", "pay", "schedule", "environment"];

export default async function StatsPage({ params, searchParams }: PageProps<"/[locale]/business/stats">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const { supabase, org } = await getBusiness(locale, "/business/stats");
  if (!org || org.locations.length === 0) return null;
  const t = await getTranslations("Stats");
  const format = await getFormatter();
  const location = pickLocation(org.locations, query.location) ?? org.locations[0];

  if (!location.pro) {
    return (
      <main className="flex max-w-4xl flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-4xl font-black tracking-brand lg:text-5xl">{t("title")}</h1>
          {org.locations.length > 1 && <LocationSelect locations={org.locations} selected={location.id} allowAll={false} />}
        </div>
        <ProGate feature="stats" />
        <EarlySignals supabase={supabase} locations={[location]} />
      </main>
    );
  }
  const { data } = await supabase.rpc("location_stats", { p_location_id: location.id });
  const stats = (data ?? { months: [], categories: [] }) as { months: Month[]; categories: Category[] };
  const months = stats.months;
  const categories = [...stats.categories].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
  );
  const monthLabel = (m: string) =>
    format.dateTime(new Date(`${m}-01T12:00:00Z`), { month: "short" });
  const num = (v: number | null) =>
    v == null ? "–" : format.number(Number(v), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const maxReviews = Math.max(1, ...months.map((m) => m.reviews));

  return (
    <main className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-brand lg:text-5xl">{t("title")}</h1>
          <p className="mt-1 text-slate">
            {location.address} · {t("subtitle")}
          </p>
        </div>
        {org.locations.length > 1 && (
          <LocationSelect locations={org.locations} selected={location.id} allowAll={false} />
        )}
      </div>

      <section className="rounded-3xl bg-white p-6">
        <h2 className="text-xl font-black">{t("reviewsPerMonth")}</h2>
        <BarChart
          bars={months.map((m) => ({
            label: monthLabel(m.month),
            value: m.reviews,
            height: m.reviews / maxReviews,
            text: String(m.reviews),
          }))}
        />
      </section>

      <section className="rounded-3xl bg-white p-6">
        <h2 className="text-xl font-black">{t("scorePerMonth")}</h2>
        <p className="mt-1 text-sm text-slate">{t("minNote")}</p>
        <BarChart
          bars={months.map((m) => ({
            label: monthLabel(m.month),
            value: m.overall,
            height: m.overall == null ? 0 : (Number(m.overall) - 1) / 4,
            text: num(m.overall),
          }))}
        />
      </section>

      <section className="rounded-3xl bg-white p-6">
        <h2 className="text-xl font-black">{t("categoriesTitle")}</h2>
        <p className="mt-1 text-sm text-slate">{t("categoriesNote")}</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left">
            <thead className="text-sm text-slate">
              <tr>
                <th className="py-2 font-black">{t("category")}</th>
                <th className="py-2 text-right font-black">{t("last60")}</th>
                <th className="py-2 text-right font-black">{t("before")}</th>
                <th className="py-2 text-right font-black">{t("change")}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => {
                const delta = c.recent != null && c.baseline != null ? Number(c.recent) - Number(c.baseline) : null;
                const warn = delta != null && delta <= -0.5;
                return (
                  <tr key={c.category} className="border-t border-[#E8E6E1]">
                    <td className="py-3 font-black">{t(`categories.${c.category}`)}</td>
                    <td className="py-3 text-right">
                      {num(c.recent)} <span className="text-sm text-slate">({c.recent_n})</span>
                    </td>
                    <td className="py-3 text-right">
                      {num(c.baseline)} <span className="text-sm text-slate">({c.baseline_n})</span>
                    </td>
                    <td className="py-3 text-right font-black">
                      {delta == null ? (
                        "–"
                      ) : (
                        <span className={warn ? "rounded-lg bg-ink px-2 py-1 text-paper" : ""}>
                          {warn && <span aria-hidden="true">⚠ </span>}
                          {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {num(Math.abs(delta))}
                          {warn && <span className="sr-only"> {t("warning")}</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {categories.length === 0 && <p className="mt-3 text-slate">{t("noData")}</p>}
        </div>
      </section>
      <EarlySignals supabase={supabase} locations={[location]} />
    </main>
  );
}
