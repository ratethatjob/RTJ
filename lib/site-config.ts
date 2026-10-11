// Operator details and prices, used by the footer, legal pages and /pricing.
// Operator: ABOVO JOBS MENA L.L.C-FZ (Dubai). Fill in the remaining «placeholders» before launch.

export const OPERATOR = {
  name: "ABOVO JOBS MENA L.L.C-FZ",
  address: "Meydan Grandstand, 6th floor, Meydan Road, Nad Al Sheba, Dubai, United Arab Emirates",
  registry: "2648676.01 (Meydan Free Zone, Dubai)",
  manager: "Gabor Levente Pinter",
  taxNumber: "105494925800001",
  email: "hello@ratethatjob.com",
  privacyEmail: "privacy@ratethatjob.com",
  hosting: "Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA",
  payments: "Stripe",
};

/** Pro price per location. null = "price on request" until set. */
export const PRICING: Record<string, { currency: string; monthly: number | null }> = {
  en: { currency: "EUR", monthly: 39 },
  hu: { currency: "HUF", monthly: 12900 },
};

/** Yearly billing: 2 months free (SPEC 7). */
export const YEARLY_MONTHS = 10;

/** Job ad packages, per ad: a low posting fee (standard), basic and pro. Price by the location's country. */
export const JOB_TIERS = ["standard", "basic", "pro"] as const;
export type JobTier = (typeof JOB_TIERS)[number];
export const JOB_PRICING: Record<string, { currency: string; prices: Record<JobTier, number> }> = {
  HU: { currency: "HUF", prices: { standard: 4990, basic: 14990, pro: 29990 } },
  default: { currency: "EUR", prices: { standard: 19, basic: 49, pro: 99 } },
};
export const jobPricing = (country: string) => JOB_PRICING[country] ?? JOB_PRICING.default;

// Social sign-in buttons on /app/sign-in, in this order. Add "apple" back once it is set up in Supabase Auth.
export const AUTH_PROVIDERS: ("apple" | "google" | "facebook")[] = ["google", "facebook"];
