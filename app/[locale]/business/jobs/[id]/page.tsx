import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ApplicationDecision, JobStatusButton } from "@/components/business/job-actions";
import { Link } from "@/i18n/navigation";
import { QuickBadge } from "@/components/jobs/quick-badge";
import { getBusiness } from "@/lib/business";
import type { JobQuestion } from "@/lib/data/types";
import { type Answers, unmetMusts } from "@/lib/job-questions";

export const instant = false;

type Application = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  start_when: string | null;
  experience: boolean | null;
  answer: string | null;
  answers: Answers;
  cv_path: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

export default async function JobApplicationsPage({ params }: PageProps<"/[locale]/business/jobs/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { supabase, org } = await getBusiness(locale, `/business/jobs/${id}`);
  if (!org) return null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, status, location_id, apply_mode, questions")
    .eq("id", id)
    .maybeSingle();
  const location = job && org.locations.find((l) => l.id === job.location_id);
  if (!job || !location) notFound();

  const questions = (job.questions ?? []) as JobQuestion[];
  const { data } = await supabase.rpc("job_application_list", { p_job_id: job.id });
  // Applicants who meet every must-have first (the list is newest first already).
  const applications = ((data ?? []) as Application[])
    .map((a) => {
      // Answers to the old single question live in `answer`.
      const answers = a.answer && a.answers.q1 == null ? { ...a.answers, q1: a.answer } : a.answers;
      return { ...a, answers, unmet: unmetMusts(questions, answers).length };
    })
    .sort((a, b) => Number(a.unmet > 0) - Number(b.unmet > 0));
  const cvPaths = applications.flatMap((a) => (a.cv_path ? [a.cv_path] : []));
  const { data: signed } = cvPaths.length
    ? await supabase.storage.from("cvs").createSignedUrls(cvPaths, 60 * 60)
    : { data: [] };
  const cvUrl = new Map((signed ?? []).flatMap((x) => (x.path && x.signedUrl ? [[x.path, x.signedUrl] as const] : [])));
  if (applications.some((a) => a.status === "submitted")) {
    await supabase.rpc("mark_applications_viewed", { p_job_id: job.id });
  }
  const t = await getTranslations("BusinessJobs");
  const format = await getFormatter();
  const status = job.status as "draft" | "open" | "closed";

  return (
    <main className="flex max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link href="/business/jobs" className="font-black text-slate">
          ← {t("title")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-4xl font-black tracking-brand lg:text-5xl">{job.title}</h1>
          <span
            className={`rounded-lg px-2.5 py-1 text-sm font-black ${
              status === "open" ? "bg-ink text-paper" : "border border-mist"
            }`}
          >
            {t(`status.${status}`)}
          </span>
          {job.apply_mode === "quick" ? <QuickBadge label={t("applyMode.quick")} /> : (
            <span className="rounded-lg border border-mist px-2.5 py-1 text-sm font-black">{t("applyMode.cv")}</span>
          )}
        </div>
        <p className="text-slate">
          {location.name} · {location.address}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/business/jobs/${job.id}/edit`} className="rounded-2xl bg-ink px-5 py-2.5 font-black text-paper">
            {t("edit")}
          </Link>
          <JobStatusButton id={job.id} status={status} />
          {status === "open" && (
            <Link
              href={`/${location.companySlug}/${location.slug}/jobs/${job.id}`}
              className="font-black underline underline-offset-4"
            >
              {t("publicPage")}
            </Link>
          )}
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-black tracking-brand">{t("applicationsTitle")}</h2>
        <p className="text-slate">{t("replyNote")}</p>
        {applications.length === 0 ? (
          <p className="rounded-3xl bg-white p-6 text-slate">{t("noApplications")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {applications.map((a) => (
              <li key={a.id} className="rounded-3xl bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xl font-black">{a.full_name}</p>
                    <p className="flex flex-wrap gap-x-4 font-black">
                      {a.email && (
                        <a href={`mailto:${a.email}`} className="break-all underline underline-offset-4">
                          {a.email}
                        </a>
                      )}
                      {a.phone && (
                        <a href={`tel:${a.phone}`} className="underline underline-offset-4">
                          {a.phone}
                        </a>
                      )}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-black ${
                      a.status === "submitted" ? "bg-signal" : "border border-mist"
                    }`}
                  >
                    {t(`appStatus.${a.status}`)}
                  </span>
                </div>
                <p className="mt-2 text-slate">
                  {a.start_when && `${t(`start.${a.start_when}`)} · `}
                  {a.experience != null && `${a.experience ? t("experienced") : t("notExperienced")} · `}
                  {t("appliedOn", { date: format.dateTime(new Date(a.created_at), { dateStyle: "medium" }) })}
                </p>
                {questions.some((q) => q.must) && (
                  <p className={`mt-3 inline-block rounded-lg px-2.5 py-1 text-sm font-black ${a.unmet ? "border-2 border-ink" : "bg-signal"}`}>
                    {a.unmet ? t("answers.unmet", { count: a.unmet }) : t("answers.allMet")}
                  </p>
                )}
                {questions.some((q) => a.answers[q.id] != null) && (
                  <dl className="mt-3 flex flex-col gap-1.5 rounded-2xl bg-paper p-4">
                    {questions.map((q) => {
                      const v = a.answers[q.id];
                      if (v == null) return null;
                      const miss = q.must != null && v !== (q.must === "yes");
                      return (
                        <div key={q.id} className="flex flex-wrap justify-between gap-x-4">
                          <dt className="text-slate">{q.text}</dt>
                          <dd className={`font-black ${miss ? "underline decoration-2 underline-offset-4" : ""}`}>
                            {typeof v === "boolean" ? `${v ? "✓" : "✗"} ${v ? t("yes") : t("no")}` : v}
                            {miss && <span className="ml-2 text-sm">({t("answers.miss")})</span>}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
                {a.cv_path && cvUrl.get(a.cv_path) && (
                  <a
                    href={cvUrl.get(a.cv_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block rounded-2xl border-2 border-ink px-4 py-2 font-black"
                  >
                    {t("answers.cv")}
                  </a>
                )}
                {a.message && <p className="mt-3 whitespace-pre-line">{a.message}</p>}
                <ApplicationDecision id={a.id} status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
