// Shapes returned by the data layer. They mirror the public views in
// supabase/migrations and never carry user ids, contact data or invite ids.

export type Locale = "en" | "hu";

export type Category =
  | "restaurant"
  | "retail"
  | "warehouse"
  | "factory"
  | "office";

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
  manager: number;
  pay: number;
  schedule: number;
  environment: number;
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
  legalEntityName: string | null;
  claimed: boolean;
  /** Rolling 12 months; null when there are no published reviews. */
  scores: LocationScores | null;
  updatedAt?: string | null;
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
};

export type ReviewFilter = "all" | "verified" | "permanent" | "temporary" | "applicants";
