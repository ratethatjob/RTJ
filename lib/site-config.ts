// Operator details and prices, used by the footer, legal pages and /pricing.
// Fill in the «placeholders» before launch.

export const OPERATOR = {
  name: "«Cégnév Kft.»",
  address: "«Cím, irányítószám, város»",
  registry: "«Cégjegyzékszám»",
  taxNumber: "«Adószám»",
  email: "hello@ratethatjob.com",
  privacyEmail: "privacy@ratethatjob.com",
  hosting: "Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA",
};

/** Pro price per location. null = "price on request" until set. */
export const PRICING: Record<string, { currency: string; monthly: number | null }> = {
  en: { currency: "EUR", monthly: null },
  hu: { currency: "HUF", monthly: null },
};

/** Yearly billing: 2 months free (SPEC 7). */
export const YEARLY_MONTHS = 10;
