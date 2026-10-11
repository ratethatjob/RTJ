import { getTranslations, setRequestLocale } from "next-intl/server";
import { jobQuestions } from "@/components/jobs/languages";
import { BackLink } from "@/components/app/back-link";
import { ApplyForm } from "@/components/app/apply-form";
import { jobPath } from "@/components/jobs/job-card";
import { getPathname, Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { getJob } from "@/lib/data/jobs";

export const instant = false;

/** The employer's page from a jobs widget: absolute http(s) URL only. */
function returnUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 500) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export default async function ApplyPage({ params, searchParams }: PageProps<"/[locale]/app/apply/[jobId]">) {
  const { locale, jobId } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const source = sp.ref === "embed" ? "embed" : "site";
  const from = returnUrl(sp.from);
  // Keep ?ref and ?from through sign-in.
  const query = new URLSearchParams({ ...(source === "embed" && { ref: "embed" }), ...(from && { from }) }).toString();
  const { supabase, user } = await requireUser(locale, `/app/apply/${jobId}${query ? `?${query}` : ""}`);
  const t = await getTranslations("Apply");
  const tj = await getTranslations("Jobs");
  const job = await getJob(jobId);
  const { data: existing } = job
    ? await supabase.from("job_applications").select("id").eq("job_id", job.id).eq("user_id", user.id).maybeSingle()
    : { data: null };

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pb-12 pt-6 lg:max-w-2xl">
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
            <p className="mt-2 text-slate">
              {job.applyMode === "quick" ? t("introQuick") : t("introCv")}{" "}
              {t("intro", { company: job.location.companyName })}
            </p>
          </header>
          <ApplyForm
            jobId={job.id}
            userId={user.id}
            company={job.location.companyName}
            mode={job.applyMode}
            questions={jobQuestions(job, locale, tj)}
            source={source}
            returnUrl={from}
            defaultEmail={user.email ?? ""}
            defaultPhone={user.phone ? `+${user.phone.replace(/^\+/, "")}` : ""}
          />
        </>
      )}
    </main>
  );
}
