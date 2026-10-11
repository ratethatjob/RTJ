// Workplace categories: the database enum public.workplace_category, the URL slugs of city hubs
// (/city/budapest/restaurants) and the order in dropdowns. Names are in the "Categories" messages
// (singular `key`, plural `keyPlural`). MAIN are shown as chips; the rest under "More".

export const CATEGORIES = [
  "restaurant",
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

// ---------------------------------------------------------------------------
// Google Places (API New) types → category. Checked in this order: specific before general.
// ---------------------------------------------------------------------------

const GOOGLE: [Category, string[], string?][] = [
  ["dental", ["dentist", "dental_clinic"]],
  ["pharmacy", ["pharmacy", "drugstore"]],
  ["healthcare", ["hospital", "doctor", "medical_lab", "medical_clinic", "physiotherapist", "chiropractor", "general_hospital", "health"]],
  ["elderly_care", ["nursing_home", "assisted_living_facility", "senior_citizen_center"]],
  ["childcare", ["preschool", "child_care_agency", "day_care_center", "kindergarten"]],
  ["education", ["school", "primary_school", "secondary_school", "university", "educational_institution", "library"]],
  ["fast_food", ["fast_food_restaurant", "hamburger_restaurant", "meal_takeaway", "sandwich_shop"]],
  ["bar", ["bar", "pub", "night_club", "wine_bar", "cocktail_bar", "karaoke", "bar_and_grill"]],
  ["restaurant", ["restaurant", "cafe", "coffee_shop", "bakery", "food_court", "ice_cream_shop", "tea_house", "dessert_shop", "meal_delivery", "food"], "_restaurant"],
  ["hotel", ["hotel", "lodging", "motel", "hostel", "resort_hotel", "bed_and_breakfast", "guest_house", "extended_stay_hotel", "inn"]],
  ["supermarket", ["supermarket", "grocery_store", "convenience_store", "food_store", "hypermarket", "market", "wholesaler"]],
  ["automotive", ["car_repair", "car_dealer", "car_wash", "auto_parts_store", "tire_shop", "car_rental"]],
  ["beauty", ["beauty_salon", "hair_salon", "hair_care", "nail_salon", "spa", "barber_shop", "beautician", "massage", "sauna", "skin_care_clinic", "wellness_center"]],
  ["fitness", ["gym", "fitness_center", "yoga_studio", "sports_club", "swimming_pool", "sports_complex", "sports_activity_location"]],
  ["events", ["movie_theater", "amusement_park", "event_venue", "stadium", "casino", "bowling_alley", "concert_hall", "performing_arts_theater", "museum", "zoo", "banquet_hall", "wedding_venue"]],
  ["public_sector", ["city_hall", "local_government_office", "courthouse", "police", "fire_station", "post_office", "embassy", "government_office"]],
  ["finance", ["bank", "accounting", "insurance_agency", "finance", "atm"]],
  ["warehouse", ["storage", "warehouse_store", "logistics_service", "warehouse"]],
  ["delivery", ["courier_service", "moving_company", "taxi_service", "transit_station", "bus_station", "train_station", "truck_stop"]],
  ["construction", ["general_contractor", "electrician", "plumber", "roofing_contractor", "painter", "construction_company"]],
  ["cleaning", ["laundry", "dry_cleaner", "cleaning_service"]],
  ["agriculture", ["farm", "ranch"]],
  ["factory", ["manufacturer", "factory", "industrial_area"]],
  ["office", ["corporate_office", "lawyer", "real_estate_agency", "consultant", "travel_agency", "employment_agency", "office"]],
  ["retail", ["store", "shopping_mall", "department_store", "gas_station"], "_store"],
];

/** Best guess from Google place types (primaryType first); null when nothing matches. */
export function categoryFromGoogle(types: string[], primaryType?: string | null): Category | null {
  const ordered = primaryType ? [primaryType, ...types.filter((t) => t !== primaryType)] : types;
  // The primary type decides when it maps; otherwise any of the types.
  for (const list of [ordered.slice(0, 1), ordered]) {
    for (const [category, names, suffix] of GOOGLE) {
      if (list.some((t) => names.includes(t) || (suffix && t.endsWith(suffix)))) return category;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// OpenStreetMap tags (key=value) → category.
// ---------------------------------------------------------------------------

const OSM_VALUES: Record<string, Category> = {
  restaurant: "restaurant", cafe: "restaurant", food_court: "restaurant", ice_cream: "restaurant", biergarten: "restaurant", bakery: "restaurant", pastry: "restaurant",
  fast_food: "fast_food",
  bar: "bar", pub: "bar", nightclub: "bar",
  pharmacy: "pharmacy",
  dentist: "dental",
  hospital: "healthcare", clinic: "healthcare", doctors: "healthcare",
  kindergarten: "childcare", childcare: "childcare",
  school: "education", college: "education", university: "education", language_school: "education", driving_school: "education",
  nursing_home: "elderly_care", social_facility: "elderly_care",
  bank: "finance", bureau_de_change: "finance",
  fuel: "retail",
  car_wash: "automotive", car_rental: "automotive", car: "automotive", car_repair: "automotive", car_parts: "automotive", tyres: "automotive",
  police: "public_sector", fire_station: "public_sector", townhall: "public_sector", courthouse: "public_sector", post_office: "public_sector",
  cinema: "events", theatre: "events", arts_centre: "events", events_venue: "events", casino: "events",
  post_depot: "delivery", taxi: "delivery", bus_station: "delivery",
  supermarket: "supermarket", marketplace: "supermarket", convenience: "supermarket", greengrocer: "supermarket", butcher: "supermarket",
  hairdresser: "beauty", beauty: "beauty", cosmetics: "beauty", massage: "beauty",
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
