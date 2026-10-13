// Address and city of a Google place from its addressComponents and formattedAddress (pure, no
// I/O; unit-tested in place-address.test.ts). Google often leaves gaps: Budapest shops without a
// locality ("XVIII, XVIII. kerület, Üllői út"), places without a street or a house number
// ("Budapest, Csepel"). We fill what we can; lib/places.ts asks Nominatim (reverse, from the
// coordinates) for whatever is still missing, and a place is refused only without a name or any
// usable location data.

export type Component = { longText: string; shortText: string; types: string[] };

// Countries that write the house number first ("350 5th Ave").
const NUMBER_FIRST = new Set(["US", "CA", "GB", "IE", "AU", "NZ", "FR"]);

/** "XVIII. kerület", "XVIII", "Budapest XVIII. kerület": a Budapest district. */
const BUDAPEST_DISTRICT = /^(budapest\s+)?[ivxl]{1,6}\.?(\s*kerület)?$/i;

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export function streetLine(route: string, number: string, country: string) {
  if (!route) return "";
  return (NUMBER_FIRST.has(country) ? [number, route] : [route, number]).filter(Boolean).join(" ").trim();
}

export type ParsedAddress = {
  address: string;
  city: string;
  country: string;
  /** Where the address came from ("street" = route + house number). */
  addressFrom: "street" | "route" | "formatted" | "area" | null;
};

export function parseGoogleAddress(p: { formattedAddress?: string; addressComponents?: Component[] }): ParsedAddress {
  const comps = p.addressComponents ?? [];
  const part = (type: string, short = false) => {
    const c = comps.find((x) => x.types.includes(type));
    return c ? (short ? c.shortText : c.longText).trim() : "";
  };
  const country = part("country", true).toUpperCase();
  const countryName = part("country");
  const admin1 = part("administrative_area_level_1");
  const districtLike = comps.some(
    (c) => c.types.some((t) => t.startsWith("sublocality") || t === "administrative_area_level_2") && BUDAPEST_DISTRICT.test(c.longText.trim()),
  );

  // City: the locality, else the postal town, else (Hungary) Budapest when the place sits in a
  // Budapest district or the Budapest region, else the smaller then the bigger administrative area.
  let city = part("locality") || part("postal_town");
  if (!city && country === "HU" && (fold(admin1) === "budapest" || districtLike)) city = "Budapest";
  if (!city) city = part("administrative_area_level_3") || part("administrative_area_level_2") || admin1;

  // Address: street + number, the street alone, else the first meaningful part of the formatted
  // address (not the city, a district, a postcode or the country), else the neighbourhood.
  const route = part("route");
  const number = part("street_number");
  if (route) {
    return { address: streetLine(route, number, country).slice(0, 150), city, country, addressFrom: number ? "street" : "route" };
  }
  const skip = new Set([fold(city), fold(countryName), fold(admin1), "budapest"]);
  const formatted = (p.formattedAddress ?? "")
    .split(",")
    .map((s) => s.trim())
    .find((s) => {
      const f = fold(s.replace(/\b\d{4,6}\b/g, ""));
      return /\p{L}/u.test(s) && f.length >= 2 && !skip.has(f) && !BUDAPEST_DISTRICT.test(s) && !/^\d+$/.test(s);
    });
  if (formatted) return { address: formatted.slice(0, 150), city, country, addressFrom: "formatted" };
  const area = part("premise") || part("neighborhood") || part("sublocality_level_2") || part("sublocality_level_1") || part("sublocality");
  if (area && !BUDAPEST_DISTRICT.test(area) && fold(area) !== fold(city)) {
    return { address: area.slice(0, 150), city, country, addressFrom: "area" };
  }
  return { address: "", city, country, addressFrom: null };
}
