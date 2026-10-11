import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";

export const instant = false;

type Row = {
  id: string;
  kind: string;
  read_at: string | null;
  created_at: string;
  data: {
    location?: string;
    address?: string;
    path?: string;
    job?: string;
    job_id?: string;
    status?: string;
    application_id?: string;
    sender?: string;
    name?: string;
    days?: number;
  };
};

export default async function NotificationsPage({ params }: PageProps<"/[locale]/app/notifications">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireUser(locale, "/app/notifications");
  const t = await getTranslations("Notifications");
  const ta = await getTranslations("Applications");
  const format = await getFormatter();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, read_at, created_at, data")
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = (data ?? []) as Row[];
  if (rows.some((r) => !r.read_at)) await supabase.rpc("mark_notifications_read");

  const href = (r: Row) =>
    r.kind === "trial_ending" || r.kind === "trial_ended" || r.kind === "payment_failed"
      ? "/business/billing"
      : r.kind === "application_message"
      ? r.data.sender === "employer"
        ? `/app/applications/${r.data.application_id}`
        : `/business/jobs/${r.data.job_id}`
      : r.kind === "application_status"
      ? "/app/applications"
      : r.kind === "new_application" && r.data.job_id
        ? `/business/jobs/${r.data.job_id}`
        : r.kind === "followed_job" && r.data.job_id && r.data.path
          ? `${r.data.path}/jobs/${r.data.job_id}`
          : (r.data.path ?? "/app/account");

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pb-12 pt-8">
      <h1 className="text-4xl font-black tracking-brand">{t("title")}</h1>
      {rows.length === 0 ? (
        <p className="rounded-3xl bg-white p-5 text-slate">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={href(r)} className="flex gap-3 rounded-3xl bg-white p-5">
                <span
                  className={`mt-2 size-2.5 shrink-0 rounded-full ${r.read_at ? "bg-transparent" : "bg-ink"}`}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block font-black">
                    {t(`kinds.${r.kind}`, {
                      location: r.data.location ?? "",
                      job: r.data.job ?? "",
                      status: r.data.status ? ta(`status.${r.data.status}`) : "",
                      sender: r.data.sender ?? "",
                      name: r.data.name ?? "",
                      days: r.data.days ?? 0,
                    })}
                  </span>
                  <span className="text-sm text-slate">
                    {r.data.address} · {format.relativeTime(new Date(r.created_at))}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
