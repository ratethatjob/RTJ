import { getTranslations, setRequestLocale } from "next-intl/server";
import { BackLink } from "@/components/app/back-link";
import { ApplyForm } from "@/components/app/apply-form";
import { jobPath } from "@/components/jobs/job-card";
import { getPathname, Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { getJob } from "@/lib/data/jobs";

export const instant = false;

export default async function ApplyPage({ params }: PageProps<"/[locale]/app/apply/[jobId]">) {
  const { locale, jobId } = await params;
  setRequestLocale(locale);
  const { supabase, user } = await requireUser(locale, `/app/apply/${jobId}`);
  const t = await getTranslations("Apply");
  const job = await getJob(jobId);
  const { data: existing } = job
    ? await supabase.from("job_applications").select("id").eq("job_id", job.id).eq("user_id", user.id).maybeSingle()
    : { data: null };

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pb-12 pt-6">
      <BackLink href={getPathname({ href: job ? jobPath(job) : "/jobs", locale })} />
      {!job ? (
        <p className="rounded-3xl bg-white p-6 text-lg">{t("closed")}</p>
      ) : existing ? (
        <section className="rounded-3xl bg-white p-6">
          <p className="text-lg">{t("alreadyApplied")}</p>
          <Link href="/app/applications" className="mt-4 inline-block font-black underline underline-offset-4">
            {t("myApplications")}
          </Link>
        </section>
      ) : (
        <>
          <header>
            <p className="font-black text-slate">
              {job.location.name} · {job.location.address}, {job.location.city}
            </p>
            <h1 className="mt-1 text-4xl font-black tracking-brand">{t("title", { title: job.title })}</h1>
            <p className="mt-2 text-slate">{t("intro", { company: job.location.companyName })}</p>
          </header>
          <ApplyForm
            jobId={job.id}
            company={job.location.companyName}
            question={job.question}
            defaultEmail={user.email ?? ""}
            defaultPhone={user.phone ? `+${user.phone.replace(/^\+/, "")}` : ""}
          />
        </>
      )}
    </main>
  );
}
