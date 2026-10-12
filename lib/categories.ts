// Workplace categories: the database enum public.workplace_category, the URL slugs of city hubs
// (/city/budapest/restaurants) and the order in dropdowns. Names are in the "Categories" messages
// (singular `key`, plural `keyPlural`). MAIN are shown as chips; the rest under "More".

export const CATEGORIES = [
  "restaurant",
  "cafe",
  "fast_food",
  "bar",
  "hotel",
  "retail",
  "supermarket",
  "warehouse",
  "factory",
  "construction",
  "office",
  "tech",
  "healthcare",
  "dental",
  "pharmacy",
  "veterinary",
  "hair",
  "beauty",
  "fitness",
  "education",
  "childcare",
  "elderly_care",
  "cleaning",
  "security",
  "delivery",
  "automotive",
  "call_center",
  "finance",
  "public_sector",
  "agriculture",
  "events",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const MAIN_CATEGORIES: Category[] = [
  "restaurant",
  "retail",
  "supermarket",
  "warehouse",
  "factory",
  "hotel",
  "healthcare",
  "office",
];

export const CATEGORY_SLUGS: Record<Category, string> = {
  restaurant: "restaurants",
  cafe: "cafes",
  fast_food: "fast-food",
  bar: "bars",
  hotel: "hotels",
  retail: "retail",
  supermarket: "supermarkets",
  warehouse: "warehouses",
  factory: "factories",
  construction: "construction",
  office: "offices",
  tech: "tech",
  healthcare: "healthcare",
  dental: "dental",
  pharmacy: "pharmacies",
  veterinary: "veterinary",
  hair: "hair-and-barber",
  beauty: "beauty",
  fitness: "fitness",
  education: "education",
  childcare: "childcare",
  elderly_care: "elderly-care",
  cleaning: "cleaning",
  security: "security",
  delivery: "delivery",
  automotive: "automotive",
  call_center: "call-centers",
  finance: "finance",
  public_sector: "public-sector",
  agriculture: "agriculture",
  events: "events",
  other: "other",
};

export const isCategory = (value: unknown): value is Category => CATEGORIES.includes(value as Category);

export function categoryFromSlug(slug: string): Category | null {
  return (Object.entries(CATEGORY_SLUGS).find(([, s]) => s === slug)?.[0] as Category) ?? null;
}

// Google Places types, OpenStreetMap tags and name keywords → category and exact place type:
// lib/place-types.ts (classifyPlace).

// ---------------------------------------------------------------------------
// OpenStreetMap tags (key=value) → category.
// ---------------------------------------------------------------------------

const OSM_VALUES: Record<string, Category> = {
  restaurant: "restaurant", food_court: "fast_food", biergarten: "bar",
  cafe: "cafe", ice_cream: "cafe", bakery: "cafe", pastry: "cafe",
  veterinary: "veterinary",
  fast_food: "fast_food",
  bar: "bar", pub: "bar", nightclub: "bar",
  pharmacy: "pharmacy",
  dentist: "dental",
  hospital: "healthcare", clinic: "healthcare", doctors: "healthcare",
  kindergarten: "childcare", childcare: "childcare",
  school: "education", college: "education", university: "education", language_school: "education", driving_school: "education",
  nursing_home: "elderly_care", social_facility: "elderly_care",
  bank: "finance", bureau_de_change: "finance",
  fuel: "automotive", parking: "automotive",
  car_wash: "automotive", car_rental: "automotive", car: "automotive", car_repair: "automotive", car_parts: "automotive", tyres: "automotive",
  police: "public_sector", fire_station: "public_sector", townhall: "public_sector", courthouse: "public_sector", post_office: "public_sector",
  cinema: "events", theatre: "events", arts_centre: "events", events_venue: "events", casino: "events",
  post_depot: "delivery", taxi: "delivery", bus_station: "delivery",
  supermarket: "supermarket", marketplace: "supermarket", convenience: "supermarket", greengrocer: "supermarket", butcher: "supermarket",
  hairdresser: "hair", barber: "hair", beauty: "beauty", cosmetics: "retail", massage: "beauty",
  hotel: "hotel", motel: "hotel", hostel: "hotel", guest_house: "hotel", apartment: "hotel",
  fitness_centre: "fitness", sports_centre: "fitness", swimming_pool: "fitness",
  warehouse: "warehouse", logistics: "warehouse",
  works: "factory", factory: "factory",
  farm: "agriculture", farmyard: "agriculture",
  dry_cleaning: "cleaning", laundry: "cleaning",
};

/** Best guess from an OSM tag; null when nothing matches. */
export function categoryFromOsm(key: string, value: string): Category | null {
  if (key === "healthcare") return value === "dentist" ? "dental" : value === "pharmacy" ? "pharmacy" : "healthcare";
  if (key === "office") {
    if (value === "it" || value === "telecommunication") return "tech";
    if (value === "government") return "public_sector";
    if (value === "financial" || value === "insurance" || value === "tax_advisor") return "finance";
    return "office";
  }
  if (key === "craft") {
    return ["builder", "electrician", "plumber", "carpenter", "roofer", "painter", "tiler", "hvac"].includes(value)
      ? "construction"
      : "factory";
  }
  if (OSM_VALUES[value]) return OSM_VALUES[value];
  if (key === "shop") return "retail";
  if (key === "industrial" || key === "man_made") return "factory";
  if (key === "tourism") return "hotel";
  if (key === "leisure") return "fitness";
  return null;
}
