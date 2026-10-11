import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";

export const instant = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** After an access request is sent: what happens now and where to follow it. */
export default async function ClaimSentPage({ params, searchParams }: PageProps<"/[locale]/business/claim/sent">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const id = typeof query.claim === "string" && UUID.test(query.claim) ? query.claim : null;
  if (!id) notFound();
  const { supabase, user } = await requireUser(locale, `/business/claim/sent?claim=${id}`);
  const { data } = await supabase
    .from("claim_requests")
    .select("id, locations(name, address)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) notFound();
  const location = data.locations as unknown as { name: string; address: string } | null;
  const t = await getTranslations("ClaimSent");
  const steps = [t("check"), t("info"), t("decision", { email: user.email ?? "" }), t("status"), t("approved")];

  return (
    <main className="flex w-full max-w-lg flex-col pb-10 pt-6 lg:pt-10">
      <svg viewBox="0 0 96 96" className="rtj-check-pop mx-auto size-24" aria-hidden="true">
        <circle cx="48" cy="48" r="46" className="fill-signal" />
        <path
          d="m28 49 13 13 27-28"
          pathLength={1}
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="rtj-check-draw text-ink"
        />
      </svg>
      <h1 className="mt-6 text-center text-4xl font-black leading-[1.05] tracking-brand">{t("title")}</h1>

      {location && (
        <div className="mt-6 rounded-3xl bg-white p-5">
          <p className="text-sm text-slate">{t("workplace")}</p>
          <p className="text-xl font-black">{location.name}</p>
          <p className="text-slate">{location.address}</p>
        </div>
      )}

      <section className="mt-6">
        <h2 className="text-xl font-black tracking-brand">{t("nextTitle")}</h2>
        <ol className="mt-3 flex flex-col gap-3">
          {steps.map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-sm font-black text-paper">
                {i + 1}
              </span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-8 flex flex-col gap-3">
        <Link href="/business" className="rounded-2xl bg-ink py-4 text-center text-lg font-black text-paper">
          {t("statusButton")}
        </Link>
        <Link href="/" className="rounded-2xl border-2 border-ink py-4 text-center text-lg font-black">
          {t("home")}
        </Link>
      </div>
    </main>
  );
}
