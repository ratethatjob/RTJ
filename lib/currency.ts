/** Default pay currency for a location's country. */
export function currencyFor(country: string) {
  return ({ HU: "HUF", AE: "AED", US: "USD", GB: "GBP", RO: "RON", CZ: "CZK", PL: "PLN" } as Record<string, string>)[country] ?? "EUR";
}
