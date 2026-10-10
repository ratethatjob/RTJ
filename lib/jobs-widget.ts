import { getTranslations } from "next-intl/server";
import { formatPay } from "@/components/jobs/pay";
import { getCompany, getLocationById } from "@/lib/data";
import { getCompanyJobs, getJob, getLocationJobs } from "@/lib/data/jobs";
import type { Job, LocationSummary } from "@/lib/data/types";
import { locationPath } from "@/lib/format";
import { MIN_REVIEWS } from "@/lib/rtj-index";
import { SITE_URL } from "@/lib/seo";

// Data for the jobs widget (widget.js, data-rtj-jobs): open jobs only, from public_jobs.
// Never includes anything about applicants or users.

export const WIDGET_SCOPES = ["job", "location", "company"] as const;
export type WidgetScope = (typeof WIDGET_SCOPES)[number];
export const WIDGET_LOCALES = ["en", "hu"] as const;

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const isSlug = (v: string) => /^[a-z0-9-]{1,80}$/.test(v);

export function validWidgetTarget(scope: WidgetScope, id: string) {
  return scope === "company" ? isSlug(id) : isUuid(id);
}

/** Jobs to show plus the RateThatJob Index for the footer; null when nothing matches. */
export async function jobsWidgetData(scope: WidgetScope, id: string, locale: string) {
  let jobs: Job[];
  let index: { name: string; reviews: number; score: number | null; url: string; rateUrl: string };
  const prefix = locale === "en" ? "" : `/${locale}`;
  const locIndex = (l: LocationSummary) => {
    const reviews = l.scores?.reviewCount ?? 0;
    return {
      name: l.name,
      reviews,
      score: reviews >= MIN_REVIEWS && l.scores ? l.scores.overall : null,
      url: `${SITE_URL}${prefix}${locationPath(l)}`,
      rateUrl: `${SITE_URL}${prefix}/app/rate/${l.id}`,
    };
  };

  if (scope === "company") {
    const company = await getCompany(id);
    if (!company) return null;
    jobs = await getCompanyJobs(id);
    // Company score: review-weighted average over its locations.
    const rated = company.locations.filter((l) => l.scores && l.scores.reviewCount > 0);
    const reviews = rated.reduce((n, l) => n + l.scores!.reviewCount, 0);
    const overall = reviews ? rated.reduce((n, l) => n + l.scores!.overall * l.scores!.reviewCount, 0) / reviews : 0;
    index = {
      name: company.name,
      reviews,
      score: reviews >= MIN_REVIEWS ? Math.round(overall * 10) / 10 : null,
      url: `${SITE_URL}${prefix}/${company.slug}`,
      rateUrl: `${SITE_URL}${prefix}/${company.slug}`,
    };
  } else {
    const location =
      scope === "job"
        ? await getJob(id).then((j) => (j ? getLocationById(j.location.id) : null))
        : await getLocationById(id);
    if (!location) return null;
    jobs = scope === "job" ? [(await getJob(id))!] : await getLocationJobs(location.id);
    index = locIndex(location);
  }

  const t = await getTranslations({ locale, namespace: "Jobs" });
  const tr = await getTranslations({ locale, namespace: "Review" });
  const tw = await getTranslations({ locale, namespace: "JobsWidget" });
  const num = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return {
    locationIds: [...new Set(jobs.map((j) => j.location.id))],
    payload: {
      scope,
      locale,
      jobs: [...jobs]
        .sort((a, b) => Number(b.featured) - Number(a.featured))
        .map((j) => {
          const path = `${prefix}/${j.location.companySlug}/${j.location.slug}/jobs/${j.id}`;
          return {
            id: j.id,
            title: j.title,
            company: j.location.companyName,
            location: j.location.name,
            address: `${j.location.address}, ${j.location.city}`,
            pay: formatPay(j, locale, t),
            schedule: t(`schedule.${j.schedule}`),
            work_type: tr(`workType.${j.workType}`),
            quick_apply: j.applyMode === "quick",
            featured: j.featured,
            url: `${SITE_URL}${path}?ref=embed`,
            apply_url: `${SITE_URL}${prefix}/app/apply/${j.id}?ref=embed`,
          };
        }),
      index: {
        name: index.name,
        score: index.score == null ? null : num.format(index.score),
        review_count: index.reviews,
        url: index.url,
        rate_url: index.rateUrl,
      },
      labels: {
        title: tw("title", { name: index.name }),
        apply: tw("apply"),
        quickApply: t("quickApply"),
        featured: t("featured"),
        noJobs: tw("noJobs"),
        index: tw("index"),
        reviews: tw("reviews", { count: index.reviews }),
        rateUs: tw("rateUs"),
        workedHere: tw("workedHere"),
        newTab: tw("newTab"),
      },
    },
  };
}
