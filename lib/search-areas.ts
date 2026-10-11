// Map search areas: preset cities the person can pick next to the workplace search.
// Names are in the "Places.areas" messages.

export const SEARCH_AREAS = {
  budapest: { lat: 47.4979, lon: 19.0402, country: "HU" },
  debrecen: { lat: 47.5316, lon: 21.6273, country: "HU" },
  szeged: { lat: 46.253, lon: 20.1414, country: "HU" },
  pecs: { lat: 46.0727, lon: 18.2323, country: "HU" },
  gyor: { lat: 47.6875, lon: 17.6504, country: "HU" },
  miskolc: { lat: 48.1035, lon: 20.7784, country: "HU" },
  dubai: { lat: 25.2048, lon: 55.2708, country: "AE" },
  abudhabi: { lat: 24.4539, lon: 54.3773, country: "AE" },
  sharjah: { lat: 25.3463, lon: 55.4209, country: "AE" },
  vienna: { lat: 48.2082, lon: 16.3738, country: "AT" },
  london: { lat: 51.5072, lon: -0.1276, country: "GB" },
  newyork: { lat: 40.7128, lon: -74.006, country: "US" },
} as const;

export type SearchAreaId = keyof typeof SEARCH_AREAS;

/** "auto" (IP or page language), "any", a preset id, or "geo:47.50,19.04" from the browser (only when allowed). */
export type AreaChoice = "auto" | "any" | SearchAreaId | `geo:${string}`;

export const isAreaId = (v: string): v is SearchAreaId => Object.hasOwn(SEARCH_AREAS, v);
