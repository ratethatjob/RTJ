import { getTranslations } from "next-intl/server";
import { BrandIcon } from "@/components/marketing/brand-icon";

type ExampleJob = { title: string; pay: string; schedule: string; quick: boolean; featured: boolean };

/** Static look-alike of the jobs widget (public/widget.js) with sample data, for the marketing page. */
export async function JobsWidgetExample({ dark = false }: { dark?: boolean }) {
  const t = await getTranslations("CareerPage.example");
  const tw = await getTranslations("JobsWidget");
  const tj = await getTranslations("Jobs");
  const jobs: ExampleJob[] = [
    { title: t("job1"), pay: t("pay1"), schedule: tj("schedule.shifts"), quick: true, featured: true },
    { title: t("job2"), pay: t("pay2"), schedule: tj("schedule.part_time"), quick: true, featured: false },
    { title: t("job3"), pay: t("pay3"), schedule: tj("schedule.full_time"), quick: false, featured: false },
  ];
  const sub = dark ? "text-mist" : "text-slate";

  return (
    <div className={`rounded-[20px] p-4 ${dark ? "bg-ink text-paper" : "border border-[#E3E1DC] bg-white text-ink"}`}>
      <p className="mx-1 mb-3 mt-0.5 text-lg font-black tracking-brand">{tw("title", { name: t("company") })}</p>
      <ul className="flex flex-col gap-2">
        {jobs.map((j) => (
          <li
            key={j.title}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-[14px] p-3.5 ${dark ? "bg-white/5" : "bg-paper"}`}
          >
            <div>
              {j.featured && <span className={`block text-[11px] font-black uppercase tracking-tagline ${sub}`}>{tj("featured")}</span>}
              <span className="text-[17px] font-black leading-tight">{j.title}</span>
              <span className={`mt-0.5 block text-[13px] ${sub}`}>{t("address")}</span>
              <span className="mt-2 flex flex-wrap gap-1.5 text-xs font-black">
                {j.quick && (
                  <span className={`rounded-md px-2 py-0.5 ${dark ? "bg-signal text-ink" : "bg-ink text-signal"}`}>⚡ {tj("quickApply")}</span>
                )}
                <span className="rounded-md bg-signal px-2 py-0.5 text-ink">{j.pay}</span>
                <span className={`rounded-md border px-2 py-px ${dark ? "border-slate" : "border-mist"}`}>{j.schedule}</span>
              </span>
            </div>
            <span className={`rounded-xl px-4 py-2.5 font-black ${dark ? "bg-signal text-ink" : "bg-ink text-paper"}`}>{tw("apply")}</span>
          </li>
        ))}
      </ul>
      <div className={`mt-3.5 flex items-center justify-between gap-3 border-t px-1 pt-3 ${dark ? "border-white/10" : "border-[#E3E1DC]"}`}>
        <span className="flex items-center gap-2 text-sm font-black">
          <BrandIcon className="h-[21px] w-[22px]" />
          {tw("index")}
        </span>
        <span className={`text-[13px] ${sub}`}>
          {tw("reviews", { count: 32 })}
          <span className="ml-1.5 inline-block rounded-lg bg-signal px-2 py-0.5 text-lg font-black text-ink">{t("score")}</span>
        </span>
      </div>
    </div>
  );
}
