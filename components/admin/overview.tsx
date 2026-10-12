import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { type Currency, HUF_PER_EUR, proPrice } from "@/lib/site-config";
import { jobOrderPrice } from "@/lib/stripe";
import type { JobTier } from "@/lib/site-config";

export type Overview = {
  reviews: {
    total: number;
    published: number;
    scheduled: number;
    scheduled_from: string | null;
    scheduled_to: string | null;
    pending: number;
    held: number;
    rejected: number;
    removed: number;
    new_today: number;
    new_7: number;
    new_30: number;
  };
  workplaces: { total: number; rated: number; new_30_by_source: Record<string, number> };
  companies: {
    claims_open: number;
    claims_approved: number;
    trial: number;
    pro: number;
    canceling: number;
    canceled: number;
    past_due: number;
    paying: { currency: "huf" | "eur"; interval: "month" | "year"; n: number }[];
  };
  users: { total: number; active_7: number; new_7: number; new_30: number };
  jobs: {
    active: number;
    expired: number;
    orders_30: { amount: number | null; currency: string | null; tier: JobTier; previous_tier: JobTier | null; country: string }[];
  };
  todo: Record<"moderation" | "claims" | "verifications" | "reports" | "disputes" | "categories" | "duplicates", number>;
  trend: { day: string; reviews: number; workplaces: number }[];
};

type AdminHref = { pathname: "/admin"; query: { tab: string } };
type Stat = { label: string; value: string; href?: AdminHref; sub?: string; alert?: boolean };

const TODO_TABS = {
  moderation: "moderation",
  claims: "claims",
  verifications: "verifications",
  reports: "reports",
  disputes: "disputes",
  categories: "workplaces",
  duplicates: "duplicates",
} as const;

function Card({ title, stats }: { title: string; stats: Stat[] }) {
  return (
    <section className="rounded-3xl bg-white p-5">
      <h2 className="text-lg font-black">{title}</h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {stats.map((s) => {
          const value = (
            <span className={`text-2xl font-black tracking-brand ${s.alert ? "text-[#C8323C]" : ""}`}>{s.value}</span>
          );
          return (
            <div key={s.label} className="min-w-0">
              <dt className="text-sm text-slate">{s.label}</dt>
              <dd>
                {s.href ? (
                  <Link href={s.href} className="underline decoration-mist underline-offset-4 hover:decoration-ink">
                    {value}
                  </Link>
                ) : (
                  value
                )}
                {s.sub && <span className="block text-xs text-slate">{s.sub}</span>}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

/** One series per chart (no legend: the title names it); each bar shows its day and value on hover. */
function Bars({ title, points, label }: { title: string; points: { day: string; value: number }[]; label: (p: { day: string; value: number }) => string }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const total = points.reduce((a, p) => a + p.value, 0);
  const w = 300;
  const h = 72;
  const step = w / points.length;
  return (
    <figure className="min-w-0 rounded-3xl bg-white p-5">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-black">{title}</span>
        <span className="text-sm text-slate">{total}</span>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h + 2}`} className="mt-3 h-20 w-full" role="img" aria-label={`${title}: ${total}`}>
        <line x1="0" x2={w} y1={h + 1} y2={h + 1} stroke="#E8E6E1" strokeWidth="1" />
        {points.map((p, i) => {
          const bh = p.value ? Math.max(3, (p.value / max) * h) : 0;
          return (
            <g key={p.day}>
              <title>{label(p)}</title>
              {/* Hit target: the whole column, bigger than the bar. */}
              <rect x={i * step} y="0" width={step} height={h + 2} fill="transparent" />
              {bh > 0 && <rect x={i * step + 1} y={h - bh + 1} width={step - 2} height={bh} rx="2" fill="#14161A" />}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export async function AdminOverview({ data }: { data: Overview }) {
  const t = await getTranslations("Admin.overview");
  const format = await getFormatter();
  const n = (v: number) => format.number(v);
  const money = (v: number, currency: string) =>
    format.number(v, { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0 });
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });
  const { reviews: r, workplaces: w, companies: c, users: u, jobs: j, todo } = data;

  // MRR from paying locations (cancel-at-period-end ones left out), priced from site-config.
  const mrr = { huf: 0, eur: 0 };
  for (const p of c.paying) {
    const currency = p.currency.toUpperCase() as Currency;
    const price = proPrice(currency, p.interval) ?? 0;
    mrr[p.currency] += (p.interval === "year" ? price / 12 : price) * p.n;
  }
  const mrrEur = mrr.eur + mrr.huf / HUF_PER_EUR;

  const revenue = { huf: 0, eur: 0 };
  for (const o of j.orders_30) {
    const priced = o.amount != null && o.currency ? { currency: o.currency, amount: o.amount / 100 } : jobOrderPrice(o.country, o.tier, o.previous_tier);
    if (priced.currency === "huf" || priced.currency === "eur") revenue[priced.currency] += priced.amount;
  }

  const sources = Object.entries(w.new_30_by_source).sort((a, b) => b[1] - a[1]);
  const scheduledBand =
    r.scheduled && r.scheduled_from && r.scheduled_to
      ? r.scheduled_from.slice(0, 10) === r.scheduled_to.slice(0, 10)
        ? date(r.scheduled_from)
        : t("band", { from: date(r.scheduled_from), to: date(r.scheduled_to) })
      : undefined;
  const todoTotal = Object.values(todo).reduce((a, b) => a + b, 0);
  const tab = (key: string): AdminHref => ({ pathname: "/admin", query: { tab: key } });

  return (
    <div className="flex flex-col gap-4">
      <section className={`rounded-3xl p-5 ${todoTotal ? "bg-white" : "bg-signal"}`}>
        <h2 className="text-lg font-black">{todoTotal ? t("todo.title") : t("todo.none")}</h2>
        {todoTotal > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {(Object.keys(TODO_TABS) as (keyof typeof TODO_TABS)[]).map((key) => (
              <li key={key}>
                <Link
                  href={tab(TODO_TABS[key])}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black ${
                    todo[key] ? "bg-[#C8323C] text-white" : "border border-mist/60 text-slate"
                  }`}
                >
                  {t(`todo.${key}`)}
                  <span>{n(todo[key])}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card
        title={t("reviews.title")}
        stats={[
          { label: t("reviews.total"), value: n(r.total) },
          { label: t("reviews.published"), value: n(r.published) },
          { label: t("reviews.scheduled"), value: n(r.scheduled), sub: scheduledBand },
          { label: t("reviews.pending"), value: n(r.pending), href: tab("moderation") },
          { label: t("reviews.held"), value: n(r.held), href: tab("moderation"), alert: r.held > 0 },
          { label: t("reviews.rejected"), value: n(r.rejected) },
          { label: t("reviews.removed"), value: n(r.removed) },
          { label: t("reviews.new"), value: `${n(r.new_today)} · ${n(r.new_7)} · ${n(r.new_30)}`, sub: t("reviews.newSub") },
        ]}
      />

      <Card
        title={t("workplaces.title")}
        stats={[
          { label: t("workplaces.total"), value: n(w.total), href: tab("workplaces") },
          { label: t("workplaces.rated"), value: n(w.rated) },
          { label: t("workplaces.unrated"), value: n(Math.max(0, w.total - w.rated)), href: tab("osm") },
          ...sources.map(([via, count]) => ({
            label: t("workplaces.newVia", { via: t.has(`via.${via}`) ? t(`via.${via}`) : via }),
            value: n(count),
            href: tab("metrics"),
          })),
        ]}
      />

      <Card
        title={t("companies.title")}
        stats={[
          { label: t("companies.claimsOpen"), value: n(c.claims_open), href: tab("claims"), alert: c.claims_open > 0 },
          { label: t("companies.claimsApproved"), value: n(c.claims_approved) },
          { label: t("companies.trial"), value: n(c.trial), href: tab("plans") },
          { label: t("companies.pro"), value: n(c.pro), href: tab("plans"), sub: c.canceling ? t("companies.canceling", { count: c.canceling }) : undefined },
          { label: t("companies.canceled"), value: n(c.canceled), href: tab("plans") },
          { label: t("companies.pastDue"), value: n(c.past_due), href: tab("plans"), alert: c.past_due > 0 },
          { label: t("companies.mrr"), value: `${money(mrr.huf, "huf")} · ${money(mrr.eur, "eur")}`, sub: t("companies.total", { value: money(mrrEur, "eur"), rate: HUF_PER_EUR }) },
          { label: t("companies.arr"), value: `${money(mrr.huf * 12, "huf")} · ${money(mrr.eur * 12, "eur")}`, sub: t("companies.total", { value: money(mrrEur * 12, "eur"), rate: HUF_PER_EUR }) },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title={t("users.title")}
          stats={[
            { label: t("users.total"), value: n(u.total), href: tab("metrics") },
            { label: t("users.active7"), value: n(u.active_7) },
            { label: t("users.new"), value: `${n(u.new_7)} · ${n(u.new_30)}`, sub: t("users.newSub") },
          ]}
        />
        <Card
          title={t("jobs.title")}
          stats={[
            { label: t("jobs.active"), value: n(j.active), href: tab("orders") },
            { label: t("jobs.expired"), value: n(j.expired) },
            { label: t("jobs.revenue30"), value: `${money(revenue.huf, "huf")} · ${money(revenue.eur, "eur")}`, href: tab("orders") },
          ]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Bars
          title={t("trend.reviews")}
          points={data.trend.map((p) => ({ day: p.day, value: p.reviews }))}
          label={(p) => `${date(p.day)}: ${p.value}`}
        />
        <Bars
          title={t("trend.workplaces")}
          points={data.trend.map((p) => ({ day: p.day, value: p.workplaces }))}
          label={(p) => `${date(p.day)}: ${p.value}`}
        />
      </div>
    </div>
  );
}
