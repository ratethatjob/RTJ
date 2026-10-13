import { createClient } from "@supabase/supabase-js";
import type {
  Category,
  FactKey,
  LocationSummary,
  Review,
  ReviewFilter,
} from "./types";
import { slugify } from "@/lib/format";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";

// Cookie-less client for public, cacheable reads of the public_* views.
export function publicClient() {
  return createClient(
    supabaseUrl!,
    supabaseKey!,
    { auth: { persistSession: false } },
  );
}

type LocationRow = {
  id: string;
  company_slug: string;
  company_name: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  city_slug?: string | null;
  country: string;
  category: Category;
  place_type?: string | null;
  place_type_en?: string | null;
  place_type_hu?: string | null;
  from_osm?: boolean | null;
  claimed: boolean;
  legal_entity_name: string | null;
  overall: number | null;
  manager: number | null;
  pay: number | null;
  schedule: number | null;
  environment: number | null;
  paid_on_time_pct: number | null;
  paid_as_promised_pct: number | null;
  overtime_paid_pct: number | null;
  hours_as_promised_pct: number | null;
  reply_rate_pct: number | null;
  avg_reply_days: number | null;
  review_count: number;
  verified_count: number;
  scores_updated_at?: string | null;
  updated_at?: string | null;
  application_count?: number | null;
  index_active?: boolean | null;
  is_demo?: boolean | null;
};

export function toLocation(row: LocationRow): LocationSummary {
  return {
    id: row.id,
    companySlug: row.company_slug,
    companyName: row.company_name,
    slug: row.slug,
    name: row.name,
    address: row.address,
    city: row.city,
    citySlug: row.city_slug ?? slugify(row.city),
    country: row.country,
    category: row.category,
    fromOsm: row.from_osm ?? false,
    placeType:
      row.place_type || row.place_type_en || row.place_type_hu
        ? { type: row.place_type ?? null, en: row.place_type_en ?? null, hu: row.place_type_hu ?? null }
        : null,
    legalEntityName: row.legal_entity_name,
    claimed: row.claimed,
    updatedAt: row.scores_updated_at ?? row.updated_at ?? null,
    indexActive: row.index_active ?? false,
    isDemo: row.is_demo ?? false,
    ghosting:
      row.reply_rate_pct == null
        ? null
        : {
            replyRate: row.reply_rate_pct,
            avgReplyDays: row.avg_reply_days == null ? null : Number(row.avg_reply_days),
            applications: row.application_count ?? 0,
          },
    scores:
      row.review_count > 0 && row.overall != null
        ? {
            overall: Number(row.overall),
            manager: row.manager == null ? null : Number(row.manager),
            pay: row.pay == null ? null : Number(row.pay),
            schedule: row.schedule == null ? null : Number(row.schedule),
            environment: row.environment == null ? null : Number(row.environment),
            reviewCount: row.review_count,
            verifiedCount: row.verified_count,
            facts: {
              paid_on_time: row.paid_on_time_pct,
              paid_as_promised: row.paid_as_promised_pct,
              overtime_paid: row.overtime_paid_pct,
              hours_as_promised: row.hours_as_promised_pct,
            },
            replyRate: row.reply_rate_pct,
            avgReplyDays: row.avg_reply_days == null ? null : Number(row.avg_reply_days),
          }
        : null,
  };
}

type ReviewRow = {
  id: string;
  display_name: string;
  position: string;
  work_type: Review["workType"];
  relationship: Review["relationship"];
  period_start: string;
  period_end: string | null;
  overall: number | null;
  /** The review's score: the average of the overall stars and the four categories. */
  score?: number | null;
  verification_level: Review["verification"];
  got_reply: boolean | null;
  reply_days: number | null;
  body: string | null;
  original_language: string | null;
  translations: Record<string, string>;
  reply_body: string | null;
  reply_language: string | null;
  reply_translations: Record<string, string>;
  published_at: string;
  helpful_count?: number | null;
} & Partial<Record<FactKey, boolean | null>>;

const FACTS: FactKey[] = [
  "paid_on_time",
  "paid_as_promised",
  "overtime_paid",
  "hours_as_promised",
  "would_return",
];

export function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    displayName: row.display_name,
    position: row.position,
    workType: row.work_type,
    relationship: row.relationship,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    overall: Number(row.score ?? row.overall ?? 0),
    verification: row.verification_level,
    facts: Object.fromEntries(
      FACTS.filter((k) => row[k] != null).map((k) => [k, row[k]]),
    ),
    gotReply: row.got_reply,
    replyDays: row.reply_days,
    body: row.body
      ? {
          original: row.body,
          language: row.original_language ?? "en",
          translations: row.translations,
        }
      : null,
    reply: row.reply_body
      ? {
          body: {
            original: row.reply_body,
            language: row.reply_language ?? "en",
            translations: row.reply_translations,
          },
        }
      : null,
    publishedAt: row.published_at,
    helpfulCount: row.helpful_count ?? 0,
  };
}

export function applyReviewFilter<
  Q extends {
    neq: (c: string, v: string) => Q;
    eq: (c: string, v: string) => Q;
  },
>(query: Q, filter: ReviewFilter): Q {
  switch (filter) {
    case "verified":
      return query.neq("verification_level", "none");
    case "permanent":
    case "temporary":
      return query.eq("work_type", filter).neq("relationship", "applicant");
    case "applicants":
      return query.eq("relationship", "applicant");
    default:
      return query;
  }
}
