import { useTranslations } from "next-intl";
import type { Insight } from "@/lib/candidate-ai";

const FIT_STYLE: Record<Insight["fit"], string> = {
  strong: "bg-signal text-ink",
  good: "bg-signal/70 text-ink",
  partial: "bg-paper text-ink",
  weak: "border border-mist text-paper",
};

export function InsightCard({
  insight,
  lang,
}: {
  insight: Insight;
  lang: "en" | "hu";
}) {
  const t = useTranslations("BusinessJobs");
  const s = insight[lang];
  const list = (title: string, items: string[]) =>
    items.length > 0 && (
      <div>
        <p className="text-sm font-black uppercase tracking-tagline text-mist">{title}</p>
        <ul className="mt-1 flex flex-col gap-1">
          {items.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      </div>
    );
  return (
    <section className="mt-4 flex flex-col gap-3 rounded-2xl bg-ink p-4 text-paper">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-black">{t("ai.title")}</p>
        <span className={`rounded-lg px-2 py-0.5 text-sm font-black ${FIT_STYLE[insight.fit]}`}>{t(`ai.fit.${insight.fit}`)}</span>
        {insight.cv_read && <span className="text-sm text-mist">{t("ai.cvRead")}</span>}
      </div>
      <p className="text-lg font-black">{s.headline}</p>
      {list(t("ai.strengths"), s.strengths)}
      {list(t("ai.concerns"), s.concerns)}
      {s.why && (
        <div>
          <p className="text-sm font-black uppercase tracking-tagline text-mist">{t("ai.why")}</p>
          <p className="mt-1">{s.why}</p>
        </div>
      )}
      {list(t("ai.ask"), s.ask)}
      <p className="text-xs text-mist">{t("ai.note")}</p>
    </section>
  );
}
