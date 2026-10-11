import { AccountShell } from "@/components/app/account-shell";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { replyToEmployer } from "@/app/[locale]/app/apply/actions";
import { FollowupsCard } from "@/components/app/followups-card";
import { MessageThread, type ThreadMessage } from "@/components/message-thread";
import { getPathname } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";

export const instant = false;

type Row = {
  id: string;
  status: string;
  created_at: string;
  jobs: { title: string; locations: { name: string; address: string; companies: { name: string } | null } | null } | null;
  application_messages: ThreadMessage[];
  application_followups: { id: string; question: string; answer: string | null; position: number }[];
};

export default async function ApplicationPage({ params }: PageProps<"/[locale]/app/applications/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireUser(locale, `/app/applications/${id}`);
  const { data } = await supabase
    .from("job_applications")
    .select(
      "id, status, created_at, jobs(title, locations(name, address, companies(name))), application_messages(id, sender, body, created_at, original_language), application_followups(id, question, answer, position)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const a = data as unknown as Row;
  const t = await getTranslations("Applications");
  const format = await getFormatter();
  const place = a.jobs?.locations;
  const company = place?.companies?.name ?? place?.name ?? "";
  const messages = [...a.application_messages].sort((x, y) => x.created_at.localeCompare(y.created_at));
  const open = a.application_followups.filter((f) => !f.answer).sort((x, y) => x.position - y.position);

  return (
    <AccountShell active="applications" back={getPathname({ href: "/app/applications", locale })}>
      <header>
        <p className="font-black text-slate">
          {place?.name} · {place?.address}
        </p>
        <h1 className="mt-1 text-4xl font-black tracking-brand">{a.jobs?.title}</h1>
        <p className="mt-2 text-slate">
          {t(`status.${a.status}`)} · {t("appliedOn", { date: format.dateTime(new Date(a.created_at), { dateStyle: "medium" }) })}
        </p>
      </header>
      {open.length > 0 && a.status !== "withdrawn" && (
        <FollowupsCard applicationId={a.id} company={company} questions={open.map(({ id, question }) => ({ id, question }))} />
      )}
      <section className="flex flex-col gap-3 rounded-3xl bg-white p-5">
        <h2 className="text-2xl font-black tracking-brand">{t("messages")}</h2>
        {messages.length === 0 && <p className="text-slate">{t("noMessages", { company })}</p>}
        <MessageThread
          messages={messages}
          viewer="applicant"
          otherName={company}
          send={replyToEmployer.bind(null, a.id)}
          readOnly={a.status === "withdrawn"}
        />
      </section>
    </AccountShell>
  );
}
