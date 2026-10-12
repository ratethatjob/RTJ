import { hasLocale } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import { formatPay } from "@/components/jobs/pay";
import { routing } from "@/i18n/routing";
import { categoryFromSlug } from "@/lib/categories";
import { getCity, getCompany, getLocationById } from "@/lib/data";
import { getJob } from "@/lib/data/jobs";
import type { LocationSummary } from "@/lib/data/types";
import { locationOgResponse, ogResponse } from "@/lib/og-image";
import { getShowcase } from "@/lib/showcase";

// Branded share images (og:image / twitter:image) per page type and language: /api/og?k=<kind>&l=<locale>
// plus id (job, location), slug (company), city + cat (city hub). Texts come from messages and our data only.

/** Review-weighted average of the rated, non-demo workplaces. */
function average(locations: LocationSummary[]) {
  const rated = locations.filter((l) => l.scores && !l.isDemo);
  const count = rated.reduce((n, l) => n + l.scores!.reviewCount, 0);
  if (!count) return null;
  return { value: rated.reduce((n, l) => n + l.scores!.overall * l.scores!.reviewCount, 0) / count, count };
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const l = sp.get("l") ?? "";
  const locale = hasLocale(routing.locales, l) ? l : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Og" });
  const tm = await getTranslations({ locale, namespace: "Metadata" });
  const tl = await getTranslations({ locale, namespace: "Location" });
  const format = await getFormatter({ locale });
  const tagline = tm("tagline");
  const score = (avg: { value: number; count: number } | null) =>
    avg
      ? {
          value: format.number(avg.value, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
          label: tl("outOf5"),
          note: t("fromReviews", { count: avg.count }),
        }
      : undefined;
  const home = () => ogResponse({ title: `${tagline}.`, sub: t("homeSub") });

  switch (sp.get("k")) {
    case "employers":
      return ogResponse({ eyebrow: t("employersEyebrow"), title: t("employersTitle"), sub: t("employersSub"), tagline });
    case "index":
      return ogResponse({ title: t("indexTitle"), sub: t("indexSub"), tagline });
    case "careers":
      return ogResponse({ title: t("careersTitle"), sub: t("careersSub"), tagline });
    case "jobs":
      return ogResponse({ title: t("jobsTitle"), sub: t("jobsSub"), tagline });
    case "job": {
      const job = await getJob(sp.get("id") ?? "");
      if (!job) return home();
      const tj = await getTranslations({ locale, namespace: "Jobs" });
      return ogResponse({
        eyebrow: `${job.location.companyName} · ${job.location.city}`,
        title: job.title,
        sub: formatPay(job, locale, tj) ?? undefined,
        tagline,
      });
    }
    case "location": {
      const location = await getLocationById(sp.get("id") ?? "");
      return location ? locationOgResponse(locale, location) : home();
    }
    case "company": {
      const company = await getCompany(sp.get("slug") ?? "");
      if (!company) return home();
      const avg = average(company.locations);
      return ogResponse({
        title: company.name,
        sub: t("workplaces", { count: company.locations.length }),
        score: score(avg),
        cta: avg ? undefined : t("beFirst"),
        tagline,
      });
    }
    case "city": {
      const category = sp.get("cat") ? categoryFromSlug(sp.get("cat")!) : null;
      const city = await getCity(sp.get("city") ?? "", category);
      if (!city || !city.locations.length) return home();
      const tc = await getTranslations({ locale, namespace: "Categories" });
      const avg = average(city.locations);
      return ogResponse({
        title: category
          ? t("cityCategoryTitle", { category: tc(`${category}Plural`), city: city.name })
          : t("cityTitle", { city: city.name }),
        sub: t("workplaces", { count: city.locations.length }),
        score: score(avg),
        cta: avg ? undefined : t("beFirst"),
        tagline,
      });
    }
    case "sample": {
      const { location } = getShowcase(locale);
      return ogResponse({
        eyebrow: t("sampleEyebrow"),
        title: location.name,
        sub: t("sampleSub"),
        score: score({ value: location.scores!.overall, count: location.scores!.reviewCount }),
        tagline,
      });
    }
    default:
      return home();
  }
}
