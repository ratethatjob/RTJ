import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Job } from "@/lib/data/types";
import { formatPay } from "./pay";

export function jobPath(job: Job) {
  return `/${job.location.companySlug}/${job.location.slug}/jobs/${job.id}`;
}

/** One open job in a list. `showPlace` adds the workplace and address. */
export async function JobCard({ job, showPlace = true }: { job: Job; showPlace?: boolean }) {
  const t = await getTranslations("Jobs");
  const locale = await getLocale();
  const format = await getFormatter();
  const pay = formatPay(job, locale, t);

  return (
    <Link href={jobPath(job)} className="flex h-full flex-col gap-1 rounded-3xl bg-white p-5 sm:p-6">
      <span className="text-2xl font-black tracking-brand">{job.title}</span>
      {showPlace && (
        <span className="text-slate">
          {job.location.name} · {job.location.address}, {job.location.city}
        </span>
      )}
      <span className="mt-2 flex flex-wrap gap-2 text-sm font-black">
        {pay && <span className="rounded-lg bg-signal px-2.5 py-1">{pay}</span>}
        <span className="rounded-lg border border-mist px-2.5 py-1">{t(`schedule.${job.schedule}`)}</span>
        <span className="rounded-lg border border-mist px-2.5 py-1">{t("noCv")}</span>
      </span>
      <span className="mt-1 text-sm text-slate">
        {t("posted", { date: format.dateTime(new Date(job.publishedAt), { dateStyle: "medium" }) })}
      </span>
    </Link>
  );
}
