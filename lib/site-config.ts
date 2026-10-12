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

/** Currencies we charge in. */
export type Currency = "HUF" | "EUR";

/** Marketing pages show prices in the page language's currency only (HU → forints, EN → euros).
 *  A new language adds its currency here (and a price below). */
export const LOCALE_CURRENCY: Record<string, Currency> = { en: "EUR", hu: "HUF" };
export const localeCurrency = (locale: string): Currency => LOCALE_CURRENCY[locale] ?? "EUR";

/** What a workplace actually pays in: by its country (Stripe Checkout, invoices, /business). */
export const countryCurrency = (country: string): Currency => (country === "HU" ? "HUF" : "EUR");

/** Pro price per location and month, per currency. null = "price on request" until set. */
export const PRO_MONTHLY: Record<Currency, number | null> = { EUR: 39, HUF: 12900 };

/** Rough rate for the admin overview's single total (MRR/ARR in euros); never shown to customers. */
export const HUF_PER_EUR = 400;

/** Yearly billing: 2 months free (SPEC 7). */
export const YEARLY_MONTHS = 10;

/** Pro price for one interval in a currency (yearly = YEARLY_MONTHS × monthly). */
export const proPrice = (currency: Currency, interval: "month" | "year") => {
  const monthly = PRO_MONTHLY[currency];
  return monthly == null ? null : interval === "year" ? monthly * YEARLY_MONTHS : monthly;
};

/** Job ad packages, per ad: a low posting fee (standard), basic and pro. */
export const JOB_TIERS = ["standard", "basic", "pro"] as const;
export type JobTier = (typeof JOB_TIERS)[number];
export const JOB_PRICES: Record<Currency, Record<JobTier, number>> = {
  HUF: { standard: 4990, basic: 14990, pro: 29990 },
  EUR: { standard: 19, basic: 49, pro: 99 },
};
/** Job ad prices in one currency (marketing: localeCurrency; checkout: the location's country). */
export const jobPrices = (currency: Currency) => ({ currency, prices: JOB_PRICES[currency] });
/** What a location's job ads cost, by its country. */
export const jobPricing = (country: string) => jobPrices(countryCurrency(country));

// Social sign-in buttons on /app/sign-in, in this order. Empty: email code only, everywhere.
// Add "google", "facebook" or "apple" back once the provider is set up in Supabase Auth.
export const AUTH_PROVIDERS: ("apple" | "google" | "facebook")[] = [];
