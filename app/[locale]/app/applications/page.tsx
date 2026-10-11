import { AccountShell } from "@/components/app/account-shell";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { WithdrawButton } from "@/components/app/withdraw-button";
import { getPathname, Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";

export const instant = false;

type Row = {
  id: string;
  status: string;
  created_at: string;
  first_reply_at: string | null;
  application_messages: { sender: string }[];
  application_followups: { answer: string | null }[];
  jobs: {
    id: string;
    title: string;
    status: string;
    location_id: string;
    locations: { name: string; address: string; slug: string; companies: { slug: string } | null } | null;
  } | null;
};

const DAY = 24 * 3600 * 1000;

export default async function ApplicationsPage({ params }: PageProps<"/[locale]/app/applications">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, user } = await requireUser(locale, "/app/applications");
  const t = await getTranslations("Applications");
  const format = await getFormatter();
  const { data } = await supabase
    .from("job_applications")
    .select(
      "id, status, created_at, first_reply_at, application_messages(sender), application_followups(answer), jobs(id, title, status, location_id, locations(name, address, slug, companies(slug)))",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];
  // eslint-disable-next-line react-hooks/purity -- request-time page, rendered per request
  const now = Date.now();

  return (
    <AccountShell active="applications" back={getPathname({ href: "/app/account", locale })}>
      <h1 className="text-4xl font-black tracking-brand">{t("title")}</h1>
      {rows.length === 0 ? (
        <p className="rounded-3xl bg-white p-5 text-slate">
          {t("empty")}{" "}
          <Link href="/jobs" className="font-black text-ink underline underline-offset-4">
            {t("findJobs")}
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((a) => {
            const job = a.jobs;
            const place = job?.locations;
            const days = Math.floor((now - Date.parse(a.created_at)) / DAY);
            const ghosted = !a.first_reply_at && days >= 14 && ["submitted", "viewed"].includes(a.status);
            const canRate = ghosted || a.status === "rejected";
            const jobHref =
              job && place?.companies && job.status === "open"
                ? `/${place.companies.slug}/${place.slug}/jobs/${job.id}`
                : null;
            return (
              <li key={a.id} className="rounded-3xl bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {jobHref ? (
                      <Link href={jobHref} className="text-lg font-black underline-offset-4 hover:underline">
                        {job?.title}
                      </Link>
                    ) : (
                      <p className="text-lg font-black">{job?.title}</p>
                    )}
                    <p className="text-slate">
                      {place?.name} · {place?.address}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-black ${
                      a.status === "hired" || a.status === "interviewing" ? "bg-signal" : "border border-mist"
                    }`}
                  >
                    {t(`status.${a.status}`)}
                  </span>
                </div>
                <p className="mt-2 text-slate">
                  {t("appliedOn", { date: format.dateTime(new Date(a.created_at), { dateStyle: "medium" }) })}
                  {ghosted && ` · ${t("noReplyYet", { days })}`}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <Link href={`/app/applications/${a.id}`} className="font-black underline underline-offset-4">
                    {t("open")}
                    {a.application_messages.some((m) => m.sender === "employer") &&
                      ` · ${t("messageCount", { count: a.application_messages.length })}`}
                  </Link>
                  {a.application_followups.some((f) => !f.answer) && a.status !== "withdrawn" && (
                    <Link
                      href={`/app/applications/${a.id}`}
                      className="rounded-lg bg-signal px-2.5 py-1 text-sm font-black"
                    >
                      {t("followupsWaiting")}
                    </Link>
                  )}
                  {canRate && job && (
                    <Link
                      href={`/app/rate/${job.location_id}`}
                      className="rounded-2xl bg-ink px-4 py-2.5 font-black text-paper"
                    >
                      {t("rateHiring")}
                    </Link>
                  )}
                  {["submitted", "viewed", "interviewing"].includes(a.status) && <WithdrawButton id={a.id} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AccountShell>
  );
}
