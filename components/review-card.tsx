import { getLocale, getTranslations } from "next-intl/server";
import { languageName as intlLanguageName } from "@/lib/intl-names";
import type { FactKey, LocalizedText, Review } from "@/lib/data/types";
import { initials, periodLabel, weeksWaited } from "@/lib/format";
import { HelpfulButton } from "./helpful-button";
import { ReportButton } from "./report-button";
import { formatScore } from "./scores";
import { TranslatedText } from "./translated-text";

const FACT_ORDER: FactKey[] = [
  "paid_on_time",
  "paid_as_promised",
  "overtime_paid",
  "hours_as_promised",
  "would_return",
];

function pickText(text: LocalizedText, locale: string) {
  if (text.language === locale) return { text: text.original, translated: false };
  const translation = text.translations[locale as keyof LocalizedText["translations"]];
  return translation
    ? { text: translation, translated: true }
    : { text: text.original, translated: false };
}

export async function ReviewCard({
  review,
  companyName,
  children,
  reportable = false,
}: {
  review: Review;
  companyName: string;
  children?: React.ReactNode;
  /** Public pages: readers can flag the review for moderation. */
  reportable?: boolean;
}) {
  const locale = await getLocale();
  const t = await getTranslations("Review");
  const isApplicant = review.relationship === "applicant";
  const languageName = (code: string) => intlLanguageName(code, locale);

  const meta = [
    review.position,
    !isApplicant && t(`workType.${review.workType}`),
    t(`relationship.${review.relationship}`),
    periodLabel(review),
  ].filter(Boolean);

  const body = review.body && pickText(review.body, locale);
  const reply = review.reply && pickText(review.reply.body, locale);

  const score = isApplicant ? null : await formatScore(review.overall);
  const badge = (
    review.verification === "none" ? (
      <span className="rounded-lg border border-mist px-3 py-1 font-black">
        {t("notVerified")}
      </span>
    ) : (
      <span className="rounded-lg bg-signal px-3 py-1 font-black">
        {review.verification === "invited"
          ? t("verifiedInvited")
          : review.verification === "application"
            ? t("verifiedApplication")
            : t("verified")}
      </span>
    )
  );

  return (
    <article className="rounded-3xl bg-white p-6">
      <header className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#E8E6E1] font-black">
          {initials(review.displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black leading-tight">{review.displayName}</h3>
          <p className="text-slate">{meta.join(" · ")}</p>
        </div>
        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          {score && <span className="text-2xl font-black">{score}</span>}
          {badge}
        </div>
      </header>

      <div className="mt-3 flex items-center justify-between gap-3 sm:hidden">
        <span className="text-xl font-black">{score}</span>
        {badge}
      </div>

      <ul className="mt-4 flex flex-wrap gap-2">
        {FACT_ORDER.filter((k) => review.facts[k] != null).map((k) => (
          <li key={k} className="rounded-lg bg-[#EDEBE6] px-3 py-1.5 font-black">
            {t(`facts.${k}`)}: {review.facts[k] ? t("yes") : t("no")}
          </li>
        ))}
        {isApplicant && review.gotReply === false && (
          <li className="rounded-lg bg-ink px-3 py-1.5 font-black text-paper">
            {weeksWaited(review) > 0
              ? t("noReplyAfter", { weeks: weeksWaited(review) })
              : t("noReply")}
          </li>
        )}
        {isApplicant && review.gotReply && review.replyDays != null && (
          <li className="rounded-lg bg-[#EDEBE6] px-3 py-1.5 font-black">
            {t("repliedIn", { days: review.replyDays })}
          </li>
        )}
      </ul>

      {body && review.body && (
        <div className="mt-4">
          <TranslatedText
            original={review.body.original}
            translated={body.translated ? body.text : null}
            originalLabel={review.body.language ? t("originalLanguage", { language: languageName(review.body.language) }) : null}
            translatedLabel={t("translated")}
            showOriginalLabel={t("showOriginal")}
            showTranslationLabel={t("showTranslation")}
          />
        </div>
      )}

      {reply && review.reply && (
        <div className="mt-4 rounded-2xl bg-paper p-5">
          <p className="font-black">{t("replyFrom", { company: companyName })}</p>
          <div className="mt-1 text-slate">
            <TranslatedText
              original={review.reply.body.original}
              translated={reply.translated ? reply.text : null}
              originalLabel={
                review.reply.body.language ? t("originalLanguage", { language: languageName(review.reply.body.language) }) : null
              }
              translatedLabel={t("translated")}
              showOriginalLabel={t("showOriginal")}
              showTranslationLabel={t("showTranslation")}
              className=""
            />
          </div>
        </div>
      )}
      {children}
      {reportable && (
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <HelpfulButton reviewId={review.id} count={review.helpfulCount ?? 0} label={t("helpful")} />
          <ReportButton reviewId={review.id} />
        </div>
      )}
    </article>
  );
}
