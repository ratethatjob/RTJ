// Two-level workplace classification: the ~30 main categories (filters, city hubs) and the exact
// place type ("Barber shop", "Bakery") shown in front of it. One table gives every common Google
// Places (API New) type its main category and an English and Hungarian label; OpenStreetMap tags
// and name keywords resolve to the same type keys.
//
// Order (classifyPlace): Google primaryType → the other Google types → name keywords (HU/EN) →
// generic Google types (store, food) → nothing (the caller may ask the AI, lib/categorize.ts).
// Only a decision from the primary type counts as certain; anything else is shown as a suggestion.

import type { Category } from "./categories.ts";

type TypeInfo = { category: Category; en: string; hu: string };

const T = (category: Category, en: string, hu: string): TypeInfo => ({ category, en, hu });

/** Google Places (API New) types → main category and labels. */
export const PLACE_TYPES: Record<string, TypeInfo> = {
  // Hair & barber
  barber_shop: T("hair", "Barber shop", "Borbély"),
  hair_salon: T("hair", "Hair salon", "Fodrászat"),
  hair_care: T("hair", "Hair care", "Hajápolás"),
  // Beauty, nails & spa
  beauty_salon: T("beauty", "Beauty salon", "Szépségszalon"),
  beautician: T("beauty", "Beautician", "Kozmetikus"),
  nail_salon: T("beauty", "Nail salon", "Körömszalon"),
  spa: T("beauty", "Spa", "Spa"),
  massage: T("beauty", "Massage", "Masszázs"),
  massage_spa: T("beauty", "Massage spa", "Masszázsszalon"),
  sauna: T("beauty", "Sauna", "Szauna"),
  skin_care_clinic: T("beauty", "Skin care clinic", "Bőrápoló szalon"),
  tanning_studio: T("beauty", "Tanning studio", "Szolárium"),
  wellness_center: T("beauty", "Wellness center", "Wellnessközpont"),
  makeup_artist: T("beauty", "Makeup artist", "Sminkes"),
  body_art_service: T("beauty", "Tattoo & piercing", "Tetováló és piercing"),
  foot_care: T("beauty", "Foot care", "Lábápolás"),
  // Cafés & bakeries
  cafe: T("cafe", "Café", "Kávézó"),
  coffee_shop: T("cafe", "Coffee shop", "Kávézó"),
  bakery: T("cafe", "Bakery", "Pékség"),
  confectionery: T("cafe", "Confectionery", "Cukrászda"),
  dessert_shop: T("cafe", "Dessert shop", "Desszertbolt"),
  dessert_restaurant: T("cafe", "Dessert restaurant", "Desszertező"),
  ice_cream_shop: T("cafe", "Ice cream shop", "Fagylaltozó"),
  tea_house: T("cafe", "Tea house", "Teaház"),
  juice_shop: T("cafe", "Juice bar", "Gyümölcslébár"),
  donut_shop: T("cafe", "Donut shop", "Fánkozó"),
  bagel_shop: T("cafe", "Bagel shop", "Bagelező"),
  acai_shop: T("cafe", "Açaí shop", "Açaí bár"),
  cat_cafe: T("cafe", "Cat café", "Macskakávézó"),
  dog_cafe: T("cafe", "Dog café", "Kutyás kávézó"),
  cake_shop: T("cafe", "Cake shop", "Tortabolt"),
  // Fast food
  fast_food_restaurant: T("fast_food", "Fast food restaurant", "Gyorsétterem"),
  hamburger_restaurant: T("fast_food", "Burger restaurant", "Hamburgerező"),
  sandwich_shop: T("fast_food", "Sandwich shop", "Szendvicsbár"),
  meal_takeaway: T("fast_food", "Takeaway", "Elviteles étel"),
  kebab_shop: T("fast_food", "Kebab shop", "Kebabos"),
  food_court: T("fast_food", "Food court", "Ételudvar"),
  hot_dog_stand: T("fast_food", "Hot dog stand", "Hot dog árus"),
  chicken_restaurant: T("fast_food", "Chicken restaurant", "Csirkés gyorsétterem"),
  // Restaurants
  restaurant: T("restaurant", "Restaurant", "Étterem"),
  pizza_restaurant: T("restaurant", "Pizzeria", "Pizzéria"),
  fine_dining_restaurant: T("restaurant", "Fine dining restaurant", "Fine dining étterem"),
  bar_and_grill: T("restaurant", "Bar & grill", "Grillétterem"),
  steak_house: T("restaurant", "Steak house", "Steakház"),
  sushi_restaurant: T("restaurant", "Sushi restaurant", "Sushi étterem"),
  diner: T("restaurant", "Diner", "Bisztró"),
  bistro: T("restaurant", "Bistro", "Bisztró"),
  breakfast_restaurant: T("restaurant", "Breakfast restaurant", "Reggeliző"),
  brunch_restaurant: T("restaurant", "Brunch restaurant", "Brunchhely"),
  buffet_restaurant: T("restaurant", "Buffet restaurant", "Svédasztalos étterem"),
  cafeteria: T("restaurant", "Cafeteria", "Menza"),
  catering_service: T("restaurant", "Catering", "Catering"),
  meal_delivery: T("restaurant", "Meal delivery", "Ételkiszállítás"),
  hungarian_restaurant: T("restaurant", "Hungarian restaurant", "Magyar étterem"),
  italian_restaurant: T("restaurant", "Italian restaurant", "Olasz étterem"),
  // Bars & nightlife
  bar: T("bar", "Bar", "Bár"),
  pub: T("bar", "Pub", "Kocsma"),
  wine_bar: T("bar", "Wine bar", "Borbár"),
  cocktail_bar: T("bar", "Cocktail bar", "Koktélbár"),
  lounge_bar: T("bar", "Lounge bar", "Lounge bár"),
  sports_bar: T("bar", "Sports bar", "Sportbár"),
  beer_garden: T("bar", "Beer garden", "Sörkert"),
  brewpub: T("bar", "Brewpub", "Sörfőzde és söröző"),
  night_club: T("bar", "Night club", "Szórakozóhely"),
  karaoke: T("bar", "Karaoke bar", "Karaokebár"),
  // Hotels
  hotel: T("hotel", "Hotel", "Szálloda"),
  lodging: T("hotel", "Accommodation", "Szállás"),
  motel: T("hotel", "Motel", "Motel"),
  hostel: T("hotel", "Hostel", "Hostel"),
  resort_hotel: T("hotel", "Resort hotel", "Üdülőszálló"),
  bed_and_breakfast: T("hotel", "Bed & breakfast", "Panzió"),
  guest_house: T("hotel", "Guest house", "Vendégház"),
  extended_stay_hotel: T("hotel", "Apartment hotel", "Apartmanhotel"),
  inn: T("hotel", "Inn", "Fogadó"),
  campground: T("hotel", "Campground", "Kemping"),
  cottage: T("hotel", "Cottage", "Nyaraló"),
  private_guest_room: T("hotel", "Guest room", "Magánszállás"),
  // Supermarkets & grocery
  supermarket: T("supermarket", "Supermarket", "Szupermarket"),
  hypermarket: T("supermarket", "Hypermarket", "Hipermarket"),
  grocery_store: T("supermarket", "Grocery store", "Élelmiszerbolt"),
  convenience_store: T("supermarket", "Convenience store", "Kisbolt"),
  food_store: T("supermarket", "Food store", "Élelmiszerbolt"),
  asian_grocery_store: T("supermarket", "Asian grocery", "Ázsiai élelmiszerbolt"),
  butcher_shop: T("supermarket", "Butcher", "Hentes"),
  market: T("supermarket", "Market", "Piac"),
  warehouse_store: T("supermarket", "Cash & carry", "Nagykereskedelmi áruház"),
  deli: T("supermarket", "Deli", "Csemegebolt"),
  liquor_store: T("supermarket", "Liquor store", "Italbolt"),
  // Retail
  store: T("retail", "Shop", "Bolt"),
  shopping_mall: T("retail", "Shopping mall", "Bevásárlóközpont"),
  department_store: T("retail", "Department store", "Áruház"),
  discount_store: T("retail", "Discount store", "Diszkont"),
  drugstore: T("retail", "Drugstore", "Drogéria"),
  clothing_store: T("retail", "Clothing store", "Ruházati bolt"),
  shoe_store: T("retail", "Shoe store", "Cipőbolt"),
  electronics_store: T("retail", "Electronics store", "Műszaki áruház"),
  cell_phone_store: T("retail", "Phone shop", "Mobiltelefon-bolt"),
  furniture_store: T("retail", "Furniture store", "Bútorbolt"),
  home_goods_store: T("retail", "Home goods store", "Lakberendezési bolt"),
  home_improvement_store: T("retail", "DIY store", "Barkácsáruház"),
  hardware_store: T("retail", "Hardware store", "Vasbolt"),
  book_store: T("retail", "Bookshop", "Könyvesbolt"),
  gift_shop: T("retail", "Gift shop", "Ajándékbolt"),
  jewelry_store: T("retail", "Jewellery store", "Ékszerbolt"),
  sporting_goods_store: T("retail", "Sports shop", "Sportbolt"),
  bicycle_store: T("retail", "Bike shop", "Kerékpárbolt"),
  pet_store: T("retail", "Pet shop", "Állatkereskedés"),
  florist: T("retail", "Florist", "Virágbolt"),
  candy_store: T("retail", "Sweet shop", "Édességbolt"),
  cosmetics_store: T("retail", "Cosmetics shop", "Kozmetikai bolt"),
  chocolate_shop: T("retail", "Chocolate shop", "Csokoládébolt"),
  toy_store: T("retail", "Toy store", "Játékbolt"),
  optician: T("retail", "Optician", "Optika"),
  tobacco_shop: T("retail", "Tobacconist", "Trafik"),
  tailor: T("retail", "Tailor", "Szabóság"),
  // Warehouse & logistics
  warehouse: T("warehouse", "Warehouse", "Raktár"),
  storage: T("warehouse", "Storage", "Raktár"),
  logistics_service: T("warehouse", "Logistics", "Logisztika"),
  distribution_center: T("warehouse", "Distribution center", "Elosztóközpont"),
  wholesaler: T("warehouse", "Wholesaler", "Nagykereskedés"),
  // Factory
  manufacturer: T("factory", "Manufacturer", "Gyártó"),
  factory: T("factory", "Factory", "Gyár"),
  chocolate_factory: T("factory", "Chocolate factory", "Csokoládégyár"),
  brewery: T("factory", "Brewery", "Sörfőzde"),
  winery: T("agriculture", "Winery", "Pincészet"),
  industrial_area: T("factory", "Industrial site", "Ipari terület"),
  // Construction & trades
  general_contractor: T("construction", "General contractor", "Generálkivitelező"),
  construction_company: T("construction", "Construction company", "Építőipari cég"),
  electrician: T("construction", "Electrician", "Villanyszerelő"),
  plumber: T("construction", "Plumber", "Vízvezeték-szerelő"),
  roofing_contractor: T("construction", "Roofer", "Tetőfedő"),
  painter: T("construction", "Painter", "Festő"),
  locksmith: T("construction", "Locksmith", "Lakatos"),
  carpenter: T("construction", "Carpenter", "Asztalos"),
  hvac_contractor: T("construction", "HVAC", "Klíma- és fűtésszerelő"),
  // Office
  corporate_office: T("office", "Office", "Iroda"),
  lawyer: T("office", "Law firm", "Ügyvédi iroda"),
  real_estate_agency: T("office", "Real estate agency", "Ingatlaniroda"),
  consultant: T("office", "Consultancy", "Tanácsadó"),
  travel_agency: T("office", "Travel agency", "Utazási iroda"),
  tour_agency: T("office", "Tour agency", "Utazásszervező"),
  employment_agency: T("office", "Employment agency", "Munkaközvetítő"),
  marketing_agency: T("office", "Marketing agency", "Marketingügynökség"),
  // IT & tech
  telecommunications_service_provider: T("tech", "Telecom provider", "Távközlési szolgáltató"),
  software_company: T("tech", "Software company", "Szoftvercég"),
  internet_cafe: T("tech", "Internet café", "Internetkávézó"),
  // Healthcare
  hospital: T("healthcare", "Hospital", "Kórház"),
  general_hospital: T("healthcare", "Hospital", "Kórház"),
  doctor: T("healthcare", "Doctor", "Orvosi rendelő"),
  medical_clinic: T("healthcare", "Medical clinic", "Klinika"),
  medical_center: T("healthcare", "Medical center", "Egészségügyi központ"),
  medical_lab: T("healthcare", "Medical lab", "Orvosi labor"),
  physiotherapist: T("healthcare", "Physiotherapist", "Gyógytornász"),
  chiropractor: T("healthcare", "Chiropractor", "Csontkovács"),
  psychologist: T("healthcare", "Psychologist", "Pszichológus"),
  // Dental, pharmacy, veterinary
  dentist: T("dental", "Dentist", "Fogorvos"),
  dental_clinic: T("dental", "Dental clinic", "Fogászat"),
  pharmacy: T("pharmacy", "Pharmacy", "Gyógyszertár"),
  veterinary_care: T("veterinary", "Veterinary clinic", "Állatorvos"),
  pet_care: T("veterinary", "Pet care", "Állatgondozás"),
  pet_groomer: T("veterinary", "Pet groomer", "Kutyakozmetika"),
  // Fitness
  gym: T("fitness", "Gym", "Edzőterem"),
  fitness_center: T("fitness", "Fitness center", "Fitneszterem"),
  yoga_studio: T("fitness", "Yoga studio", "Jógastúdió"),
  sports_club: T("fitness", "Sports club", "Sportklub"),
  sports_complex: T("fitness", "Sports complex", "Sportközpont"),
  sports_activity_location: T("fitness", "Sports venue", "Sportlétesítmény"),
  sports_coaching: T("fitness", "Sports coaching", "Edzés és oktatás"),
  swimming_pool: T("fitness", "Swimming pool", "Uszoda"),
  golf_course: T("fitness", "Golf course", "Golfpálya"),
  ice_skating_rink: T("fitness", "Ice rink", "Jégpálya"),
  ski_resort: T("fitness", "Ski resort", "Síterep"),
  // Education & childcare
  school: T("education", "School", "Iskola"),
  primary_school: T("education", "Primary school", "Általános iskola"),
  secondary_school: T("education", "Secondary school", "Középiskola"),
  university: T("education", "University", "Egyetem"),
  educational_institution: T("education", "Educational institution", "Oktatási intézmény"),
  language_school: T("education", "Language school", "Nyelviskola"),
  driving_school: T("education", "Driving school", "Autósiskola"),
  library: T("education", "Library", "Könyvtár"),
  preschool: T("childcare", "Kindergarten", "Óvoda"),
  child_care_agency: T("childcare", "Childcare", "Gyermekfelügyelet"),
  day_care_center: T("childcare", "Day care", "Bölcsőde"),
  // Elderly & social care
  nursing_home: T("elderly_care", "Nursing home", "Idősek otthona"),
  assisted_living_facility: T("elderly_care", "Assisted living", "Idősgondozó otthon"),
  senior_citizen_center: T("elderly_care", "Senior center", "Idősek klubja"),
  // Cleaning & security
  laundry: T("cleaning", "Laundry", "Mosoda"),
  dry_cleaner: T("cleaning", "Dry cleaner", "Vegytisztító"),
  cleaning_service: T("cleaning", "Cleaning service", "Takarítócég"),
  security_service: T("security", "Security company", "Biztonsági szolgálat"),
  // Delivery & transport
  courier_service: T("delivery", "Courier", "Futárszolgálat"),
  food_delivery: T("delivery", "Food delivery", "Ételfutár"),
  moving_company: T("delivery", "Moving company", "Költöztető cég"),
  taxi_service: T("delivery", "Taxi", "Taxi"),
  taxi_stand: T("delivery", "Taxi stand", "Taxiállomás"),
  trucking_company: T("delivery", "Trucking company", "Fuvarozó cég"),
  transit_station: T("delivery", "Transit station", "Közlekedési csomópont"),
  transit_depot: T("delivery", "Transit depot", "Járműtelep"),
  bus_station: T("delivery", "Bus station", "Buszpályaudvar"),
  train_station: T("delivery", "Train station", "Vasútállomás"),
  airport: T("delivery", "Airport", "Repülőtér"),
  international_airport: T("delivery", "Airport", "Nemzetközi repülőtér"),
  ferry_terminal: T("delivery", "Ferry terminal", "Kompkikötő"),
  truck_stop: T("delivery", "Truck stop", "Kamionparkoló"),
  // Automotive
  car_repair: T("automotive", "Car repair", "Autószerviz"),
  car_dealer: T("automotive", "Car dealer", "Autókereskedés"),
  car_wash: T("automotive", "Car wash", "Autómosó"),
  car_rental: T("automotive", "Car rental", "Autókölcsönző"),
  auto_parts_store: T("automotive", "Car parts store", "Autóalkatrész-bolt"),
  tire_shop: T("automotive", "Tyre shop", "Gumiszerviz"),
  gas_station: T("automotive", "Petrol station", "Benzinkút"),
  electric_vehicle_charging_station: T("automotive", "EV charging", "Elektromosautó-töltő"),
  parking: T("automotive", "Parking", "Parkoló"),
  park_and_ride: T("automotive", "Park & ride", "P+R parkoló"),
  rest_stop: T("automotive", "Rest stop", "Pihenőhely"),
  // Call center, finance
  call_center: T("call_center", "Call center", "Call center"),
  bank: T("finance", "Bank", "Bank"),
  accounting: T("finance", "Accountant", "Könyvelő"),
  insurance_agency: T("finance", "Insurance agency", "Biztosító"),
  finance: T("finance", "Financial services", "Pénzügyi szolgáltató"),
  atm: T("finance", "ATM", "ATM"),
  // Public sector
  city_hall: T("public_sector", "City hall", "Városháza"),
  local_government_office: T("public_sector", "Local government", "Önkormányzat"),
  government_office: T("public_sector", "Government office", "Kormányhivatal"),
  courthouse: T("public_sector", "Courthouse", "Bíróság"),
  police: T("public_sector", "Police", "Rendőrség"),
  fire_station: T("public_sector", "Fire station", "Tűzoltóság"),
  post_office: T("public_sector", "Post office", "Posta"),
  embassy: T("public_sector", "Embassy", "Nagykövetség"),
  community_center: T("public_sector", "Community center", "Közösségi ház"),
  cultural_center: T("public_sector", "Cultural center", "Művelődési ház"),
  tourist_information_center: T("public_sector", "Tourist information", "Turisztikai információ"),
  cemetery: T("public_sector", "Cemetery", "Temető"),
  // Agriculture
  farm: T("agriculture", "Farm", "Gazdaság"),
  ranch: T("agriculture", "Ranch", "Tanya"),
  // Events & entertainment
  movie_theater: T("events", "Cinema", "Mozi"),
  casino: T("events", "Casino", "Kaszinó"),
  amusement_park: T("events", "Amusement park", "Vidámpark"),
  amusement_center: T("events", "Amusement center", "Játékterem"),
  bowling_alley: T("events", "Bowling alley", "Bowlingpálya"),
  event_venue: T("events", "Event venue", "Rendezvényhelyszín"),
  banquet_hall: T("events", "Banquet hall", "Rendezvényterem"),
  wedding_venue: T("events", "Wedding venue", "Esküvőhelyszín"),
  convention_center: T("events", "Convention center", "Konferenciaközpont"),
  concert_hall: T("events", "Concert hall", "Koncertterem"),
  performing_arts_theater: T("events", "Theatre", "Színház"),
  opera_house: T("events", "Opera house", "Operaház"),
  museum: T("events", "Museum", "Múzeum"),
  art_gallery: T("events", "Art gallery", "Galéria"),
  zoo: T("events", "Zoo", "Állatkert"),
  aquarium: T("events", "Aquarium", "Akvárium"),
  water_park: T("events", "Water park", "Élményfürdő"),
  stadium: T("events", "Stadium", "Stadion"),
  arena: T("events", "Arena", "Aréna"),
  escape_room: T("events", "Escape room", "Szabadulószoba"),
  video_arcade: T("events", "Arcade", "Játékterem"),
  tourist_attraction: T("events", "Tourist attraction", "Látványosság"),
  // Places of worship and other: shown as the exact type, main category "Other".
  church: T("other", "Church", "Templom"),
  mosque: T("other", "Mosque", "Mecset"),
  synagogue: T("other", "Synagogue", "Zsinagóga"),
  funeral_home: T("other", "Funeral home", "Temetkezési vállalat"),
};

/** Types that say little on their own: used only after the name keywords. */
const GENERIC = new Set(["store", "food", "lodging", "establishment", "point_of_interest", "finance", "health", "service"]);

const NOT_A_TYPE = new Set(["establishment", "point_of_interest", "political", "premise", "street_address", "geocode"]);

export const placeTypeInfo = (type: string | null | undefined): TypeInfo | null =>
  (type && PLACE_TYPES[type]) || (type && type.endsWith("_restaurant") ? T("restaurant", "Restaurant", "Étterem") : null);

/** Label of a type in the page language: our table first, else the stored map label. */
export function placeTypeLabel(
  type: string | null | undefined,
  locale: string,
  stored?: { en?: string | null; hu?: string | null },
): string | null {
  const info = placeTypeInfo(type);
  const lang = locale === "hu" ? "hu" : "en";
  return (info && info[lang]) || stored?.[lang] || null;
}

// ---------------------------------------------------------------------------
// Name keywords (Hungarian and English). Matched on whole words of the normalized name; a key
// ending in "*" also matches longer words ("logisztik*" → "logisztikai"), one starting with "*"
// the end of a compound ("*gyar" → "szalamigyar", never "magyar"). First match wins, so specific
// words come first.
// ---------------------------------------------------------------------------

const NAME_RULES: [string, string[]][] = [
  ["barber_shop", ["borbely*", "barber*", "barbershop"]],
  ["hair_salon", ["fodrasz*", "hair", "hairdresser", "hajszalon", "hajstudio", "frizura"]],
  ["nail_salon", ["korom*", "nail*", "manikur*"]],
  ["beauty_salon", ["kozmetik*", "beauty", "szepsegszalon", "cosmetic*", "smink*"]],
  ["massage", ["masszazs*", "massage", "thai masszazs"]],
  ["tanning_studio", ["szolarium*"]],
  ["body_art_service", ["tetovalo", "tattoo", "piercing"]],
  ["dentist", ["fogorvos*", "fogaszat*", "dental", "dentist", "fogtechnik*"]],
  ["pharmacy", ["gyogyszertar*", "patika*", "pharmacy"]],
  ["veterinary_care", ["allatorvos*", "allatklinika", "vet", "veterinary", "allatkorhaz"]],
  ["pet_groomer", ["kutyakozmetika", "kutyakozmetikus"]],
  ["hospital", ["korhaz*", "hospital"]],
  ["medical_clinic", ["klinika*", "clinic", "rendelo*", "szakrendelo*", "egeszsegkozpont"]],
  ["medical_lab", ["labor", "laboratorium", "laboratory"]],
  ["physiotherapist", ["gyogytorna*", "physio*", "fizioterap*"]],
  ["bakery", ["pekseg*", "bakery", "pek"]],
  ["confectionery", ["cukraszda*", "patisserie", "cukrasz*"]],
  ["ice_cream_shop", ["fagylalt*", "fagyi*", "gelato", "ice cream"]],
  ["coffee_shop", ["kavezo*", "kave*", "coffee", "cafe", "espresso*", "barista"]],
  ["tea_house", ["teahaz", "tea house"]],
  ["hamburger_restaurant", ["burger*", "mcdonald*", "burger king"]],
  ["kebab_shop", ["kebab*", "gyros*", "doner"]],
  ["fast_food_restaurant", ["gyorsetterem", "kfc", "subway", "langos*", "hot dog", "fast food"]],
  ["pizza_restaurant", ["pizza*", "pizzeria"]],
  ["restaurant", ["etterem*", "restaurant", "bistro", "bisztro", "vendeglo", "csarda", "trattoria", "kifozde", "etkezde", "sushi", "steakhouse", "grill"]],
  ["night_club", ["nightclub", "night club", "ejszakai klub"]],
  ["pub", ["pub", "kocsma", "sorozo", "romkocsma", "borozo", "sorkert"]],
  ["bar", ["bar", "drinkbar", "koktelbar", "borbar"]],
  ["hotel", ["hotel*", "szalloda", "szallo"]],
  ["hostel", ["hostel"]],
  ["guest_house", ["panzio", "vendeghaz", "apartman*", "guesthouse"]],
  ["spa", ["spa", "wellness"]],
  ["supermarket", ["spar", "interspar", "tesco", "lidl", "aldi", "penny", "auchan", "coop", "cba", "supermarket", "szupermarket", "hipermarket"]],
  ["convenience_store", ["abc", "kisbolt", "elelmiszer*", "vegyesbolt", "non stop", "nonstop"]],
  ["warehouse_store", ["metro"]],
  ["butcher_shop", ["hentes*", "butcher"]],
  ["market", ["piac", "vasarcsarnok", "market"]],
  ["drugstore", ["dm", "rossmann", "muller", "drogeria"]],
  ["gas_station", ["benzinkut", "mol", "omv", "shell", "lukoil"]],
  ["car_wash", ["automoso", "car wash", "kezi automoso"]],
  ["tire_shop", ["gumiszerviz", "gumis"]],
  ["car_repair", ["autoszerviz", "autojavito", "karosszeria*"]],
  ["car_dealer", ["autoszalon", "autokereskedes", "autohaz"]],
  ["parking", ["parkolo*", "parkolas", "parking", "parkhaz"]],
  ["warehouse", ["raktar*", "warehouse"]],
  ["logistics_service", ["logisztik*", "logistic*", "elosztokozpont", "fulfillment"]],
  ["courier_service", ["futar*", "courier", "gls", "dpd", "dhl", "wolt", "foodora", "csomag*"]],
  ["trucking_company", ["fuvar*", "szallitmany*", "trucking", "spedicio"]],
  ["taxi_service", ["taxi"]],
  ["factory", ["*gyar", "gyara", "*uzem", "uzeme", "factory", "manufactur*", "termelo*"]],
  ["general_contractor", ["epitoipar*", "epito", "kivitelez*", "construction", "generalkivitelezo"]],
  ["electrician", ["villanyszerelo*", "villamossag*"]],
  ["plumber", ["vizszerelo*", "vizvezetek*"]],
  ["software_company", ["software", "szoftver*", "informatika*", "tech"]],
  ["call_center", ["call center", "callcenter", "ugyfelszolgalat*", "contact center"]],
  ["bank", ["bank", "otp", "erste", "raiffeisen", "k&h", "mbh", "cib", "unicredit"]],
  ["insurance_agency", ["biztosito*", "insurance"]],
  ["accounting", ["konyvelo*", "konyveles*", "accounting", "adotanacsado"]],
  ["post_office", ["posta"]],
  ["local_government_office", ["onkormanyzat*", "polgarmesteri", "varoshaza", "kormanyablak", "kormanyhivatal", "hivatal"]],
  ["police", ["rendorseg", "rendorkapitanysag"]],
  ["preschool", ["ovoda", "kindergarten"]],
  ["day_care_center", ["bolcsode", "nursery"]],
  ["university", ["egyetem*", "university", "foiskola"]],
  ["secondary_school", ["gimnazium", "szakgimnazium", "technikum", "szakkozepiskola"]],
  ["primary_school", ["altalanos iskola"]],
  ["language_school", ["nyelviskola"]],
  ["school", ["iskola", "school", "akademia", "academy"]],
  ["nursing_home", ["idosotthon", "idosek otthona", "nursing home", "idosgondozo"]],
  ["cleaning_service", ["takarito*", "takaritas", "cleaning", "letesitmenyuzemeltet*"]],
  ["laundry", ["mosoda", "laundry", "patyolat"]],
  ["dry_cleaner", ["vegytisztito"]],
  ["security_service", ["security", "biztonsagi", "vagyonvedel*", "orzo*"]],
  ["gym", ["fitness", "fitnesz", "gym", "edzoterem", "crossfit"]],
  ["yoga_studio", ["joga*", "yoga"]],
  ["swimming_pool", ["uszoda", "strand*", "furdo"]],
  ["movie_theater", ["mozi", "cinema", "cinema city"]],
  ["casino", ["kaszino", "casino"]],
  ["performing_arts_theater", ["szinhaz", "theatre", "theater"]],
  ["museum", ["muzeum", "museum"]],
  ["zoo", ["allatkert", "zoo"]],
  ["event_venue", ["rendezveny*", "event*"]],
  ["farm", ["farm", "tanya", "mezogazdasag*", "gazdasag"]],
];

/** Lowercase, no accents, words split on anything that isn't a letter, digit or "&". */
export function normalizeName(name: string): string {
  return ` ${name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9&]+/g, " ")
    .trim()} `;
}

// Words that end like a keyword but mean something else.
const NOT_SUFFIX = new Set(["magyar", "megyar"]);

function matches(name: string, key: string) {
  if (key.startsWith("*")) {
    const end = key.slice(1);
    return name.split(" ").some((w) => w.endsWith(end) && !NOT_SUFFIX.has(w));
  }
  const prefix = key.endsWith("*");
  const word = prefix ? key.slice(0, -1) : key;
  if (prefix) return name.includes(` ${word}`);
  return name.includes(` ${word} `);
}

/** The place type a workplace name points to (e.g. "Barber Shop Budapest" → barber_shop). */
export function typeFromName(name: string): string | null {
  const n = normalizeName(name);
  for (const [type, keys] of NAME_RULES) if (keys.some((k) => matches(n, k))) return type;
  return null;
}

// ---------------------------------------------------------------------------
// OpenStreetMap tags → the same type keys.
// ---------------------------------------------------------------------------

const OSM_TYPES: Record<string, string> = {
  "shop=hairdresser": "hair_salon", "shop=barber": "barber_shop", "shop=beauty": "beauty_salon", "shop=cosmetics": "cosmetics_store",
  "shop=massage": "massage", "leisure=sauna": "sauna", "shop=tattoo": "body_art_service", "amenity=spa": "spa",
  "amenity=cafe": "cafe", "shop=bakery": "bakery", "shop=pastry": "confectionery", "shop=confectionery": "candy_store",
  "amenity=ice_cream": "ice_cream_shop", "amenity=fast_food": "fast_food_restaurant", "amenity=food_court": "food_court",
  "amenity=restaurant": "restaurant", "amenity=biergarten": "beer_garden", "amenity=bar": "bar", "amenity=pub": "pub",
  "amenity=nightclub": "night_club", "tourism=hotel": "hotel", "tourism=motel": "motel", "tourism=hostel": "hostel",
  "tourism=guest_house": "guest_house", "tourism=apartment": "private_guest_room", "tourism=camp_site": "campground",
  "shop=supermarket": "supermarket", "shop=convenience": "convenience_store", "shop=greengrocer": "grocery_store",
  "shop=butcher": "butcher_shop", "amenity=marketplace": "market", "shop=alcohol": "liquor_store", "shop=wholesale": "wholesaler",
  "shop=mall": "shopping_mall", "shop=department_store": "department_store", "shop=chemist": "drugstore", "shop=clothes": "clothing_store",
  "shop=shoes": "shoe_store", "shop=electronics": "electronics_store", "shop=mobile_phone": "cell_phone_store", "shop=furniture": "furniture_store",
  "shop=doityourself": "home_improvement_store", "shop=hardware": "hardware_store", "shop=books": "book_store", "shop=gift": "gift_shop",
  "shop=jewelry": "jewelry_store", "shop=sports": "sporting_goods_store", "shop=bicycle": "bicycle_store", "shop=pet": "pet_store",
  "shop=florist": "florist", "shop=toys": "toy_store", "shop=optician": "optician", "shop=tobacco": "tobacco_shop",
  "shop=car": "car_dealer", "shop=car_repair": "car_repair", "shop=car_parts": "auto_parts_store", "shop=tyres": "tire_shop",
  "amenity=car_wash": "car_wash", "amenity=car_rental": "car_rental", "amenity=fuel": "gas_station", "amenity=parking": "parking",
  "amenity=charging_station": "electric_vehicle_charging_station",
  "amenity=pharmacy": "pharmacy", "healthcare=pharmacy": "pharmacy", "amenity=dentist": "dentist", "healthcare=dentist": "dentist",
  "amenity=hospital": "hospital", "healthcare=hospital": "hospital", "amenity=clinic": "medical_clinic", "healthcare=clinic": "medical_clinic",
  "amenity=doctors": "doctor", "healthcare=doctor": "doctor", "healthcare=laboratory": "medical_lab", "healthcare=physiotherapist": "physiotherapist",
  "amenity=veterinary": "veterinary_care", "shop=pet_grooming": "pet_groomer",
  "amenity=kindergarten": "preschool", "amenity=childcare": "day_care_center", "amenity=school": "school", "amenity=college": "school",
  "amenity=university": "university", "amenity=language_school": "language_school", "amenity=driving_school": "driving_school",
  "amenity=library": "library", "amenity=nursing_home": "nursing_home", "amenity=social_facility": "senior_citizen_center",
  "shop=laundry": "laundry", "shop=dry_cleaning": "dry_cleaner", "amenity=bank": "bank", "office=insurance": "insurance_agency",
  "office=accountant": "accounting", "office=tax_advisor": "accounting", "office=lawyer": "lawyer", "office=estate_agent": "real_estate_agency",
  "shop=travel_agency": "travel_agency", "office=employment_agency": "employment_agency", "office=it": "software_company",
  "office=telecommunication": "telecommunications_service_provider", "office=company": "corporate_office",
  "amenity=police": "police", "amenity=fire_station": "fire_station", "amenity=townhall": "city_hall", "amenity=courthouse": "courthouse",
  "amenity=post_office": "post_office", "amenity=community_centre": "community_center", "amenity=post_depot": "courier_service",
  "amenity=taxi": "taxi_stand", "amenity=bus_station": "bus_station", "railway=station": "train_station", "aeroway=aerodrome": "airport",
  "amenity=cinema": "movie_theater", "amenity=theatre": "performing_arts_theater", "amenity=casino": "casino", "amenity=arts_centre": "cultural_center",
  "amenity=events_venue": "event_venue", "tourism=museum": "museum", "tourism=zoo": "zoo", "leisure=water_park": "water_park",
  "leisure=fitness_centre": "gym", "leisure=sports_centre": "sports_complex", "leisure=swimming_pool": "swimming_pool",
  "leisure=bowling_alley": "bowling_alley", "leisure=escape_game": "escape_room",
  "building=warehouse": "warehouse", "industrial=warehouse": "warehouse", "industrial=logistics": "logistics_service",
  "man_made=works": "factory", "industrial=factory": "factory", "craft=brewery": "brewery", "craft=winery": "winery",
  "craft=electrician": "electrician", "craft=plumber": "plumber", "craft=carpenter": "carpenter", "craft=roofer": "roofing_contractor",
  "craft=painter": "painter", "craft=hvac": "hvac_contractor", "craft=builder": "general_contractor", "craft=tailor": "tailor",
  "place=farm": "farm", "landuse=farmyard": "farm", "amenity=place_of_worship": "church",
};

/** Type key for an OSM tag ("shop", "hairdresser" → hair_salon); null when we don't know it. */
export const typeFromOsm = (key: string, value: string): string | null => OSM_TYPES[`${key}=${value}`] ?? null;

// ---------------------------------------------------------------------------

export type CategorySource = "google_primary" | "google_types" | "osm" | "name" | "generic" | "ai" | "user" | "admin";

export type Classification = {
  category: Category | null;
  /** Exact type key (Google type, or the type our name/OSM rules point to). */
  placeType: string | null;
  source: CategorySource | null;
  /** Only the map's primary type is certain; everything else is shown as a suggestion. */
  certain: boolean;
};

/** Main category and exact type from map data and the name, in the documented order. */
export function classifyPlace(input: {
  name: string;
  primaryType?: string | null;
  types?: string[];
  osm?: { key: string; value: string } | null;
}): Classification {
  const types = (input.types ?? []).filter((t) => !NOT_A_TYPE.has(t));
  const primary = input.primaryType && !NOT_A_TYPE.has(input.primaryType) ? input.primaryType : null;
  const known = (t: string | null | undefined) => (t && !GENERIC.has(t) ? placeTypeInfo(t) : null);

  // (a) Google's primary type.
  if (primary && known(primary)) {
    return { category: known(primary)!.category, placeType: primary, source: "google_primary", certain: true };
  }
  // (b) The other specific types (Google), or the OSM tag.
  const other = types.find((t) => known(t));
  if (other) return { category: known(other)!.category, placeType: other, source: "google_types", certain: false };
  const osmType = input.osm ? typeFromOsm(input.osm.key, input.osm.value) : null;
  if (osmType && placeTypeInfo(osmType)) {
    return { category: placeTypeInfo(osmType)!.category, placeType: osmType, source: "osm", certain: false };
  }
  // (c) Words in the name.
  const named = typeFromName(input.name);
  if (named) {
    // A specific map type we have no label for stays the exact type; a generic one ("store") doesn't.
    const placeType = primary && !GENERIC.has(primary) ? primary : named;
    return { category: placeTypeInfo(named)!.category, placeType, source: "name", certain: false };
  }
  // (d) Generic map types (shop, food, lodging), then the caller may ask the AI.
  const generic = [primary, ...types].find((t) => t && placeTypeInfo(t));
  if (generic) return { category: placeTypeInfo(generic)!.category, placeType: generic, source: "generic", certain: false };
  return { category: null, placeType: primary, source: null, certain: false };
}

/** "Barber shop · Hair & barber": the exact type first, then the main category (once, when the
 *  type has no label or says the same). */
export function kindLabel(
  placeType: { type: string | null; en: string | null; hu: string | null } | null | undefined,
  locale: string,
  categoryName: string,
): string {
  const label = placeType ? placeTypeLabel(placeType.type, locale, placeType) : null;
  return label && label.toLowerCase() !== categoryName.toLowerCase() ? `${label} · ${categoryName}` : categoryName;
}
