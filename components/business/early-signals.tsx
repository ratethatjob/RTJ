import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Direction, Topic } from "@/lib/early-signals";
import type { createClient } from "@/lib/supabase/server";

type Row = {
  location_id: string;
  unlocked: boolean;
  ready: boolean;
  topics: Topic[];
  directions: Direction[];
};

/** "Early signals" (Pro): anonymous, aggregated themes from reviews that aren't live yet. No
 *  text, scores, dates or counts of single reviews; without Pro only a blurred preview (no data
 *  reaches the page: early_signals_for() returns nothing but "locked"). */
export async function EarlySignals({
  supabase,
  locations,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  locations: { id: string; address: string }[];
}) {
  if (!locations.length) return null;
  const t = await getTranslations("EarlySignals");
  const tc = await getTranslations("Stats.categories");
  const locale = (await getLocale()) === "hu" ? "hu" : "en";
  const { data } = await supabase.rpc("early_signals_for", { p_location_ids: locations.map((l) => l.id) });
  const rows = (data ?? []) as Row[];
  if (!rows.length) return null;
  const many = locations.length > 1;
  const address = (id: string) => locations.find((l) => l.id === id)?.address ?? "";
  const category = (c: string) => (tc.has(c) ? tc(c) : t(`topicCategories.${c}`));

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-black tracking-brand">{t("title")}</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate">{t("intro")}</p>
      {rows.every((r) => !r.unlocked) ? (
        <Locked />
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.location_id} className="rounded-3xl bg-white p-5">
              {many && <p className="mb-2 font-black">{address(r.location_id)}</p>}
              {!r.unlocked ? (
                <p className="text-slate">
                  {t("lockedShort")}{" "}
                  <Link href="/business/billing" className="font-black text-ink underline underline-offset-4">
                    {t("cta")}
                  </Link>
                </p>
              ) : !r.ready ? (
                <p className="text-slate">{t("notReady")}</p>
              ) : r.topics.length === 0 && r.directions.length === 0 ? (
                <p className="text-slate">{t("nothing")}</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {r.directions.length > 0 && (
                    <ul className="flex flex-col gap-1.5">
                      {r.directions.map((d) => (
                        <li key={d.category} className="flex items-start gap-2">
                          <span
                            aria-hidden="true"
                            className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs font-black ${
                              d.direction === "worse" ? "bg-[#C8323C] text-white" : "bg-signal text-ink"
                            }`}
                          >
                            {d.direction === "worse" ? "↓" : "↑"}
                          </span>
                          <span>
                            <span className="font-black">{category(d.category)}:</span> {t(`direction.${d.direction}`)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.topics.length > 0 && (
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-tagline text-slate">{t("themes")}</h3>
                      <ul className="mt-2 flex flex-col gap-2">
                        {r.topics.map((topic) => (
                          <li key={topic.category} className="rounded-2xl bg-paper px-4 py-3">
                            <span className="text-sm font-black text-slate">{category(topic.category)}</span>
                            <p>{topic[locale]}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Blurred, made-up preview without any data, and the way to Pro. */
async function Locked() {
  const t = await getTranslations("EarlySignals");
  return (
    <div className="relative mt-4 overflow-hidden rounded-3xl bg-white p-5">
      <div aria-hidden="true" className="pointer-events-none select-none blur-sm">
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-paper px-4 py-3">
              <div className="h-3 w-24 rounded bg-mist/60" />
              <div className="mt-2 h-3 w-4/5 rounded bg-mist/40" />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-0 grid place-items-center bg-white/40 p-4 text-center">
        <div>
          <p className="font-black">{t("locked")}</p>
          <Link href="/business/billing" className="mt-3 inline-block rounded-xl bg-ink px-5 py-2.5 font-black text-paper">
            {t("cta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
