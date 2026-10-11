// Tax status and invoice footer of a Stripe customer (pure, unit-tested in invoice-tax.test.ts).

type TaxExempt = "none" | "exempt" | "reverse";

const EU = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU",
  "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
]);

/** UAE buyers: normal; EU businesses with an EU VAT number: reverse charge; outside the EU and
 *  the UAE: exempt; EU without an EU VAT number: normal. null without a billing country. */
export function taxExemptFor(country: string | null | undefined, taxIdTypes: string[]): TaxExempt | null {
  const c = (country ?? "").toUpperCase();
  if (!c) return null;
  if (c === "AE") return "none";
  if (EU.has(c)) return taxIdTypes.includes("eu_vat") ? "reverse" : "none";
  return "exempt";
}

/** Seller line at the top of every invoice footer (official name, Meydan address, our TRN). */
export const invoiceSeller = (trn: string) =>
  `ABOVO JOBS MENA L.L.C-FZ · Meydan Grandstand, Meydan Road, Nad Al Sheba, Dubai, UAE · TRN ${trn}`;

/** Invoice footer for a customer's tax status: the seller line plus the legal basis. */
export function invoiceFooter(taxExempt: string | null | undefined, trn: string): string {
  const seller = invoiceSeller(trn);
  if (taxExempt === "reverse") {
    return `${seller}\nReverse charge – VAT to be accounted for by the recipient pursuant to Article 196 of Council Directive 2006/112/EC. / Fordított adózás – az ÁFÁ-t a vevő fizeti.`;
  }
  if (taxExempt === "exempt") {
    return `${seller}\nExport of services – outside the scope of UAE VAT / zero-rated. No VAT charged.`;
  }
  return seller;
}
