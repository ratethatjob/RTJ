import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JobForm } from "@/components/business/job-form";
import { getBusiness } from "@/lib/business";
import { currencyFor } from "@/lib/currency";
import type { JobQuestion } from "@/lib/data/types";
import type { JobLanguage } from "@/lib/languages";

export const instant = false;

export default async function EditJobPage({ params }: PageProps<"/[locale]/business/jobs/[id]/edit">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { supabase, org } = await getBusiness(locale, `/business/jobs/${id}/edit`);
  if (!org) return null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
  const location = job && org.locations.find((l) => l.id === job.location_id);
  if (!job || !location) notFound();
  const t = await getTranslations("BusinessJobs");
  const str = (n: number | null) => (n == null ? "" : String(Number(n)));

  return (
    <main className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-4xl font-black tracking-brand lg:text-5xl">{t("editJob")}</h1>
      <JobForm
        orgId={org.id}
        jobId={job.id}
        status={job.status}
        publishedTier={job.published_at ? job.tier : null}
        locations={[{ id: location.id, name: location.name, address: location.address, country: location.country }]}
        initial={{
          locationId: job.location_id,
          title: job.title,
          workType: job.work_type,
          schedule: job.schedule,
          payMin: str(job.pay_min),
          payMax: str(job.pay_max),
          payCurrency: job.pay_currency ?? currencyFor(location.country),
          payPeriod: job.pay_period ?? "hour",
          description: job.description,
          responsibilities: (job.responsibilities ?? []).join("\n"),
          requirements: (job.requirements ?? []).join("\n"),
          offers: (job.offers ?? []).join("\n"),
          applyMode: job.apply_mode ?? "quick",
          questions: (job.questions ?? []) as JobQuestion[],
          tier: job.tier ?? "standard",
          adLanguage: job.ad_language ?? "",
          languages: (job.languages ?? []) as JobLanguage[],
          closesAt: job.closes_at ?? "",
        }}
      />
    </main>
  );
}
