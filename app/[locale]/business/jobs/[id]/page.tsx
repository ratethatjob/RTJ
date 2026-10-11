import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { messageApplicant } from "@/app/[locale]/business/jobs/actions";
import { CallButton, InsightButton } from "@/components/business/application-tools";
import { ApplicationDecision, JobStatusButton } from "@/components/business/job-actions";
import { JobPayment } from "@/components/business/job-payment";
import { MessageThread, type ThreadMessage } from "@/components/message-thread";
import { Link } from "@/i18n/navigation";
import { QuickBadge } from "@/components/jobs/quick-badge";
import { getBusiness } from "@/lib/business";
import type { JobQuestion } from "@/lib/data/types";
import type { Insight } from "@/lib/candidate-ai";
import { InsightCard } from "@/components/business/insight-card";
import { jobQuestions } from "@/components/jobs/languages";
import { type Answers, unmetMusts } from "@/lib/job-questions";
import { type JobLanguage, languageName } from "@/lib/languages";
import type { JobTier } from "@/lib/site-config";

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
  last_called_at: string | null;
  insight: Insight | null;
  followups: { question: string; answer: string | null }[];
  messages: ThreadMessage[];
  message: string | null;
  status: string;
  created_at: string;
};

export default async function JobApplicationsPage({ params, searchParams }: PageProps<"/[locale]/business/jobs/[id]">) {
  const { locale, id } = await params;
  const { checkout } = await searchParams;
  setRequestLocale(locale);
  const { supabase, org } = await getBusiness(locale, `/business/jobs/${id}`);
  if (!org) return null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, status, location_id, apply_mode, questions, languages, tier")
    .eq("id", id)
    .maybeSingle();
  const location = job && org.locations.find((l) => l.id === job.location_id);
  if (!job || !location) notFound();

  const tj = await getTranslations("Jobs");
  // The employer's questions plus one must-have per expected language.
  const questions = jobQuestions(
    { questions: (job.questions ?? []) as JobQuestion[], languages: (job.languages ?? []) as JobLanguage[] },
    locale,
    tj,
  );
  const { data: messageLanguages } = await supabase.rpc("job_application_message_languages", { p_job_id: job.id });
  const messageLanguage = new Map(
    ((messageLanguages ?? []) as { id: string; message_language: string | null }[]).map((m) => [m.id, m.message_language]),
  );
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
  const tr = await getTranslations("Review");
  const format = await getFormatter();
  const status = job.status as "draft" | "open" | "closed";
  // The order waiting for payment (owners and HR can read orders; a draft always needs one).
  const { data: order } = await supabase
    .from("job_orders")
    .select("tier, previous_tier")
    .eq("job_id", job.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const returned = checkout === "success" || checkout === "cancelled" ? checkout : null;
  const awaiting = order ?? (status === "draft" && returned === "success" ? { tier: job.tier, previous_tier: null } : null);
  const ai = job.tier === "basic" || job.tier === "pro";
  const lang = locale === "hu" ? "hu" : "en";

  return (
    <main className="flex max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-3">
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
          <span className="rounded-lg border border-mist px-2.5 py-1 text-sm font-black">
            {t(`packages.${job.tier}.name`)}
          </span>
        </div>
        <p className="text-slate">
          {location.name} · {location.address}
        </p>
        {awaiting && (
          <JobPayment
            jobId={job.id}
            tier={awaiting.tier as JobTier}
            upgrade={Boolean(awaiting.previous_tier)}
            returned={returned}
          />
        )}
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
                {a.followups.some((f) => f.answer) && (
                  <dl className="mt-3 flex flex-col gap-2 rounded-2xl bg-paper p-4">
                    <p className="text-sm font-black uppercase tracking-tagline text-slate">{t("ai.followups")}</p>
                    {a.followups.map((f) =>
                      f.answer ? (
                        <div key={f.question}>
                          <dt className="text-slate">{f.question}</dt>
                          <dd className="font-black">{f.answer}</dd>
                        </div>
                      ) : null,
                    )}
                  </dl>
                )}
                {a.message && (
                  <div className="mt-3">
                    <p className="whitespace-pre-line">{a.message}</p>
                    {messageLanguage.get(a.id) && (
                      <p className="mt-1 text-sm text-slate">
                        {tr("originalLanguage", { language: languageName(messageLanguage.get(a.id)!, locale) })}
                      </p>
                    )}
                  </div>
                )}
                {ai ? (
                  a.insight ? (
                    <InsightCard insight={a.insight} lang={lang} />
                  ) : (
                    <div className="mt-4 rounded-2xl bg-ink p-4 text-paper">
                      <p className="font-black">{t("ai.title")}</p>
                      <p className="mt-1 text-sm text-mist">{t("ai.pending")}</p>
                      <div className="mt-3 [&_button]:border-paper">
                        <InsightButton jobId={job.id} applicationId={a.id} refresh={false} />
                      </div>
                    </div>
                  )
                ) : (
                  <p className="mt-4 rounded-2xl border border-dashed border-mist p-4 text-sm text-slate">
                    {t("ai.upsell")}{" "}
                    <Link href={`/business/jobs/${job.id}/edit`} className="font-black text-ink underline underline-offset-4">
                      {t("ai.upgrade")}
                    </Link>
                  </p>
                )}
                {ai && a.insight && (
                  <div className="mt-2">
                    <InsightButton jobId={job.id} applicationId={a.id} refresh />
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {a.phone && <CallButton applicationId={a.id} phone={a.phone} />}
                  {a.last_called_at && (
                    <span className="text-sm text-slate">
                      {t("tools.called", { date: format.dateTime(new Date(a.last_called_at), { dateStyle: "medium" }) })}
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <MessageThread
                    messages={a.messages}
                    viewer="employer"
                    otherName={a.full_name}
                    send={async (body: string) => {
                      "use server";
                      const result = await messageApplicant(job.id, a.id, body);
                      return result.error ? { error: true as const } : { ok: true as const };
                    }}
                    collapsed={a.messages.length === 0}
                  />
                </div>
                <ApplicationDecision id={a.id} status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
