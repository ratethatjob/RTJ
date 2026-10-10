import { getFormatter, getTranslations } from "next-intl/server";
import type { LocationScores } from "@/lib/data/types";

export async function formatScore(value: number) {
  const format = await getFormatter();
  return format.number(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export async function ScoreTile({
  score,
  size = "lg",
}: {
  score: number;
  size?: "sm" | "lg";
}) {
  const t = await getTranslations("Location");
  return (
    <div
      className={`flex shrink-0 flex-col items-center justify-center rounded-3xl bg-signal text-ink ${
        size === "lg" ? "size-28 lg:size-32" : "size-20 rounded-2xl"
      }`}
    >
      <span
        className={`font-black leading-none tracking-brand ${
          size === "lg" ? "text-5xl" : "text-3xl"
        }`}
      >
        {await formatScore(score)}
      </span>
      {size === "lg" && <span className="mt-1 text-sm font-black">{t("outOf5")}</span>}
    </div>
  );
}

const FACT_KEYS = [
  "paid_on_time",
  "paid_as_promised",
  "overtime_paid",
  "hours_as_promised",
] as const;

export function Bar({ value, dark = false }: { value: number; dark?: boolean }) {
  return (
    <div className={`h-2 rounded-full ${dark ? "bg-white/15" : "bg-[#E8E6E1]"}`}>
      <div
        className={`h-2 rounded-full ${dark ? "bg-signal" : "bg-ink"}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export async function FactBars({ facts }: { facts: LocationScores["facts"] }) {
  const t = await getTranslations("Location");
  return (
    <section className="rounded-3xl bg-white p-6">
      <h2 className="mb-4 text-sm font-black uppercase tracking-tagline text-slate">
        {t("theFacts")}
      </h2>
      <dl className="flex flex-col gap-4">
        {FACT_KEYS.map((key) =>
          facts[key] == null ? null : (
            <div key={key}>
              <div className="mb-2 flex justify-between font-black">
                <dt>{t(`facts.${key}`)}</dt>
                <dd>{facts[key]}%</dd>
              </div>
              <Bar value={facts[key]} />
            </div>
          ),
        )}
      </dl>
    </section>
  );
}

export async function GhostingMeter({
  replyRate,
  avgReplyDays,
}: {
  replyRate: number;
  avgReplyDays: number | null;
}) {
  const t = await getTranslations("Location");
  return (
    <section className="flex items-center justify-between gap-4 rounded-3xl bg-ink p-6 text-paper">
      <div>
        <h2 className="text-sm font-black uppercase tracking-tagline text-mist">
          {t("ghostingMeter")}
        </h2>
        <p className="mt-1 text-lg font-black leading-tight">
          {t("repliesTo", { rate: replyRate })}
        </p>
        {avgReplyDays != null && (
          <p className="text-mist">{t("avgReplyTime", { days: avgReplyDays })}</p>
        )}
      </div>
      <p className="text-5xl font-black tracking-brand text-signal">{replyRate}%</p>
    </section>
  );
}

export async function CategoryScores({ scores }: { scores: LocationScores }) {
  const t = await getTranslations("Location.categories");
  const keys = ["manager", "pay", "schedule", "environment"] as const;
  return (
    <dl className="grid grid-cols-2 gap-3">
      {await Promise.all(
        keys.map(async (key) => (
          <div
            key={key}
            className="flex items-center justify-between gap-2 rounded-2xl bg-white px-5 py-4 font-black"
          >
            <dt>{t(key)}</dt>
            <dd>{await formatScore(scores[key])}</dd>
          </div>
        )),
      )}
    </dl>
  );
}
