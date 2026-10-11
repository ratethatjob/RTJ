import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ShareButton } from "@/components/app/share-button";
import { getPathname, Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { getLocationById } from "@/lib/data";
import { locationPath } from "@/lib/format";

export const instant = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** After a review is sent: what happens to it now, read from the review itself. */
export default async function ReviewSentPage({ params, searchParams }: PageProps<"/[locale]/app/rate/sent">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const id = typeof query.review === "string" && UUID.test(query.review) ? query.review : null;
  if (!id) notFound();
  const { supabase, user } = await requireUser(locale, `/app/rate/sent?review=${id}`);
  const [{ data: review }, { count: documents }] = await Promise.all([
    supabase
      .from("reviews")
      .select("status, publish_mode, publish_at, hold_reason, body, location_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("verifications").select("id", { count: "exact", head: true }).eq("review_id", id),
  ]);
  if (!review) notFound();
  const location = await getLocationById(review.location_id);
  if (!location) notFound();

  const t = await getTranslations("ReviewSent");
  const format = await getFormatter();
  const href = locationPath(location);
  // eslint-disable-next-line react-hooks/purity -- request-time page, rendered per request
  const now = Date.now();

  const steps: string[] = [];
  if (review.status === "published") steps.push(t("published"));
  else if (review.status === "pending_moderation") steps.push(t("held"));
  else if (review.status === "scheduled" && !review.publish_at) steps.push(t("afterLeaving"));
  else if (review.status === "scheduled" && Date.parse(review.publish_at!) <= now) steps.push(t("soon"));
  else if (review.status === "scheduled") {
    steps.push(t("later", { date: format.dateTime(new Date(review.publish_at!), { dateStyle: "long" }) }));
    steps.push(t(review.publish_mode === "delayed" ? "laterChosen" : "laterAnonymity"));
  }
  if (review.body && review.status === "scheduled") steps.push(t("textCheck"));
  if (documents) steps.push(t("document"));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-10 pt-10 lg:max-w-lg lg:pt-16">
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

      <div className="mt-6 rounded-3xl bg-white p-5">
        <p className="text-sm text-slate">{t("workplace")}</p>
        <p className="text-xl font-black">{location.name}</p>
        <p className="text-slate">{location.address}</p>
      </div>

      <section className="mt-6">
        <h2 className="text-xl font-black tracking-brand">{t("nextTitle")}</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {steps.map((s) => (
            <li key={s} className="flex gap-3">
              <span className="mt-2 size-2 shrink-0 rounded-full bg-ink" aria-hidden="true" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
        {query.upload === "failed" && (
          <p role="alert" className="mt-4 rounded-2xl bg-ink px-4 py-3 font-black text-paper">
            {t("uploadFailed")}
          </p>
        )}
        <p className="mt-4 text-sm text-slate">
          {t.rich("statusInAccount", {
            link: (chunks) => (
              <Link href="/app/account" className="font-black text-ink underline underline-offset-4">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </section>

      <div className="mt-8 flex flex-col gap-3">
        <Link href={href} className="rounded-2xl bg-ink py-4 text-center text-lg font-black text-paper">
          {t("viewWorkplace")}
        </Link>
        <Link href="/app/rate" className="rounded-2xl border-2 border-ink py-4 text-center text-lg font-black">
          {t("rateAnother")}
        </Link>
        <ShareButton
          url={getPathname({ href, locale })}
          title={location.name}
          text={t("shareText", { name: location.name })}
          label={t("share")}
        />
      </div>
    </main>
  );
}
