// Shapes returned by the data layer. They mirror the public views in
// supabase/migrations and never carry user ids, contact data or invite ids.

export type Locale = "en" | "hu";

export type { Category } from "@/lib/categories";
import type { Category } from "@/lib/categories";

export type Relationship = "applicant" | "trial_shift" | "current" | "former";
export type WorkType = "permanent" | "temporary";
export type VerificationLevel = "none" | "document" | "invited" | "application";

export type FactKey =
  | "paid_on_time"
  | "paid_as_promised"
  | "overtime_paid"
  | "hours_as_promised"
  | "would_return";

/** Text in its original language plus machine translations by locale. */
export type LocalizedText = {
  original: string;
  language: string;
  translations: Partial<Record<Locale, string>>;
};

export type LocationScores = {
  overall: number;
  manager: number | null;
  pay: number | null;
  schedule: number | null;
  environment: number | null;
  reviewCount: number;
  verifiedCount: number;
  /** Share of "yes" answers, 0–100. */
  facts: Record<Exclude<FactKey, "would_return">, number | null>;
  replyRate: number | null;
  avgReplyDays: number | null;
};

export type LocationSummary = {
  id: string;
  companySlug: string;
  companyName: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  citySlug: string;
  country: string;
  category: Category;
  /** Exact place type ("barber_shop") with the labels stored from the map; lib/place-types.ts. */
  placeType?: { type: string | null; en: string | null; hu: string | null } | null;
  /** Name and address come (also) from OpenStreetMap: the page shows the ODbL attribution. */
  fromOsm?: boolean;
  legalEntityName: string | null;
  claimed: boolean;
  /** Rolling 12 months; null when there are no published reviews. */
  scores: LocationScores | null;
  /** Reply rate to applicants; from RateThatJob applications when `applications` ≥ 5. */
  ghosting?: { replyRate: number; avgReplyDays: number | null; applications: number } | null;
  updatedAt?: string | null;
  /** Pro (trial or paid) is on, so embeds show the Index. Sample data leaves it out (= on). */
  indexActive?: boolean;
  /** Made-up demo data: labelled, noindex, not in sitemaps. */
  isDemo?: boolean;
};

export type Review = {
  id: string;
  displayName: string;
  position: string;
  workType: WorkType;
  relationship: Relationship;
  periodStart: string;
  periodEnd: string | null;
  overall: number;
  verification: VerificationLevel;
  facts: Partial<Record<FactKey, boolean>>;
  gotReply: boolean | null;
  replyDays: number | null;
  body: LocalizedText | null;
  reply: { body: LocalizedText } | null;
  publishedAt: string;
  helpfulCount?: number;
};

export type ReviewFilter = "all" | "verified" | "permanent" | "temporary" | "applicants";

export type JobSchedule = "full_time" | "part_time" | "shifts" | "flexible";
export type ApplyMode = "quick" | "cv";

/** One question of an employer's question set. `must` marks a must-have yes/no answer. */
export type JobQuestion = {
  id: string;
  text: string;
  type: "yes_no" | "text";
  required: boolean;
  must: "yes" | "no" | null;
};
export type PayPeriod = "hour" | "day" | "week" | "month" | "year";

/** An open job post as the public sees it. */
export type Job = {
  id: string;
  title: string;
  workType: WorkType;
  schedule: JobSchedule;
  payMin: number | null;
  payMax: number | null;
  payCurrency: string | null;
  payPeriod: PayPeriod | null;
  description: string;
  question: string | null;
  applyMode: ApplyMode;
  questions: JobQuestion[];
  /** Language the ad is written in (ISO 639-1). */
  adLanguage: string | null;
  /** Languages expected from applicants, with level. */
  languages: { code: string; level: "basic" | "conversational" | "fluent" | "native" }[];
  responsibilities: string[];
  requirements: string[];
  offers: string[];
  /** Pro package: shown first in job search. */
  featured: boolean;
  /** Made-up demo data. */
  isDemo?: boolean;
  publishedAt: string;
  closesAt: string | null;
  updatedAt: string;
  location: {
    id: string;
    slug: string;
    name: string;
    address: string;
    city: string;
    citySlug: string;
    country: string;
    category: Category;
    companySlug: string;
    companyName: string;
  };
};
