import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import type { LocationSummary } from "./data/types";
import { localeAlternates } from "./seo";

export async function locationMetadata(
  location: LocationSummary,
  locale: string,
  path: string,
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "Location" });
  const format = await getFormatter({ locale });
  const s = location.scores;
  const title = t("metaTitle", { company: location.companyName, location: location.address });
  const description = s
    ? t("metaDescription", {
        company: location.companyName,
        address: `${location.address}, ${location.city}`,
        score: format.number(s.overall, { maximumFractionDigits: 1 }),
        count: s.reviewCount,
        paidOnTime: s.facts.paid_on_time ?? "–",
        replyRate: s.replyRate ?? "–",
      })
    : t("metaDescriptionEmpty", {
        company: location.companyName,
        address: `${location.address}, ${location.city}`,
      });

  return {
    title: `${title} | RateThatJob`,
    description,
    alternates: localeAlternates(path, locale),
    openGraph: { title, description, type: "website" },
  };
}
