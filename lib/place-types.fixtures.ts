// Real workplaces in Budapest and Szeged with the place types Google Maps gives them (primary type
// first). Used by lib/place-types.test.ts and the category table in docs/kategoriak.md.

export type PlaceExample = {
  name: string;
  city: string;
  primaryType: string | null;
  types: string[];
  /** Expected main category and exact type. */
  category: string;
  placeType: string | null;
};

export const PLACE_EXAMPLES: PlaceExample[] = [
  { name: "Barber Shop Budapest Agora", city: "Budapest", primaryType: "barber_shop", types: ["barber_shop", "hair_care"], category: "hair", placeType: "barber_shop" },
  { name: "Mr. Barber", city: "Szeged", primaryType: "barber_shop", types: ["barber_shop"], category: "hair", placeType: "barber_shop" },
  { name: "Hajvarázs Fodrászat", city: "Szeged", primaryType: "hair_salon", types: ["hair_salon", "beauty_salon", "hair_care"], category: "hair", placeType: "hair_salon" },
  { name: "Nailbar Budapest", city: "Budapest", primaryType: "nail_salon", types: ["nail_salon", "beauty_salon"], category: "beauty", placeType: "nail_salon" },
  { name: "Thai Masszázs Szeged", city: "Szeged", primaryType: "massage", types: ["massage", "spa"], category: "beauty", placeType: "massage" },
  { name: "Szamos Cukrászda", city: "Budapest", primaryType: "confectionery", types: ["confectionery", "cafe", "bakery"], category: "cafe", placeType: "confectionery" },
  { name: "Lipóti Pékség", city: "Szeged", primaryType: "bakery", types: ["bakery", "food_store"], category: "cafe", placeType: "bakery" },
  { name: "Starbucks Oktogon", city: "Budapest", primaryType: "coffee_shop", types: ["coffee_shop", "cafe", "breakfast_restaurant"], category: "cafe", placeType: "coffee_shop" },
  { name: "Espresso Embassy", city: "Budapest", primaryType: "coffee_shop", types: ["coffee_shop", "cafe"], category: "cafe", placeType: "coffee_shop" },
  { name: "Gelarto Rosa", city: "Budapest", primaryType: "ice_cream_shop", types: ["ice_cream_shop", "dessert_shop"], category: "cafe", placeType: "ice_cream_shop" },
  { name: "McDonald's Nyugati", city: "Budapest", primaryType: "fast_food_restaurant", types: ["fast_food_restaurant", "hamburger_restaurant", "restaurant"], category: "fast_food", placeType: "fast_food_restaurant" },
  { name: "Burger King Árkád", city: "Szeged", primaryType: "hamburger_restaurant", types: ["hamburger_restaurant", "fast_food_restaurant"], category: "fast_food", placeType: "hamburger_restaurant" },
  { name: "Costes", city: "Budapest", primaryType: "fine_dining_restaurant", types: ["fine_dining_restaurant", "restaurant"], category: "restaurant", placeType: "fine_dining_restaurant" },
  { name: "Halászcsárda", city: "Szeged", primaryType: "hungarian_restaurant", types: ["hungarian_restaurant", "restaurant"], category: "restaurant", placeType: "hungarian_restaurant" },
  { name: "Pizza Me", city: "Budapest", primaryType: "pizza_restaurant", types: ["pizza_restaurant", "restaurant"], category: "restaurant", placeType: "pizza_restaurant" },
  { name: "Szimpla Kert", city: "Budapest", primaryType: "bar", types: ["bar", "night_club"], category: "bar", placeType: "bar" },
  { name: "Instant-Fogas", city: "Budapest", primaryType: "night_club", types: ["night_club", "bar"], category: "bar", placeType: "night_club" },
  { name: "Hilton Budapest", city: "Budapest", primaryType: "hotel", types: ["hotel", "lodging"], category: "hotel", placeType: "hotel" },
  { name: "Hotel Forrás", city: "Szeged", primaryType: "resort_hotel", types: ["resort_hotel", "hotel", "spa", "lodging"], category: "hotel", placeType: "resort_hotel" },
  { name: "Tesco Hipermarket", city: "Szeged", primaryType: "hypermarket", types: ["hypermarket", "supermarket", "grocery_store"], category: "supermarket", placeType: "hypermarket" },
  { name: "SPAR Market", city: "Budapest", primaryType: "supermarket", types: ["supermarket", "grocery_store", "food_store"], category: "supermarket", placeType: "supermarket" },
  { name: "dm drogerie markt", city: "Szeged", primaryType: "drugstore", types: ["drugstore", "store"], category: "retail", placeType: "drugstore" },
  { name: "Rossmann", city: "Budapest", primaryType: "drugstore", types: ["drugstore", "store"], category: "retail", placeType: "drugstore" },
  { name: "Szent Margit Gyógyszertár", city: "Budapest", primaryType: "pharmacy", types: ["pharmacy", "health"], category: "pharmacy", placeType: "pharmacy" },
  { name: "IKEA Budaörs", city: "Budaörs", primaryType: "furniture_store", types: ["furniture_store", "home_goods_store", "store"], category: "retail", placeType: "furniture_store" },
  { name: "Decathlon Szeged", city: "Szeged", primaryType: "sporting_goods_store", types: ["sporting_goods_store", "store"], category: "retail", placeType: "sporting_goods_store" },
  { name: "Telekom Shop", city: "Szeged", primaryType: "cell_phone_store", types: ["cell_phone_store", "store"], category: "retail", placeType: "cell_phone_store" },
  { name: "MOL töltőállomás", city: "Szeged", primaryType: "gas_station", types: ["gas_station", "convenience_store"], category: "automotive", placeType: "gas_station" },
  { name: "Shell", city: "Budapest", primaryType: "gas_station", types: ["gas_station", "car_wash", "convenience_store"], category: "automotive", placeType: "gas_station" },
  { name: "BUDget Parking - Reptéri parkolás", city: "Vecsés", primaryType: "parking", types: ["parking"], category: "automotive", placeType: "parking" },
  { name: "Wash & Go Autómosó", city: "Budapest", primaryType: "car_wash", types: ["car_wash"], category: "automotive", placeType: "car_wash" },
  { name: "Kézi Autómosó", city: "Szeged", primaryType: null, types: [], category: "automotive", placeType: "car_wash" },
  { name: "GLS Depó", city: "Szeged", primaryType: "courier_service", types: ["courier_service"], category: "delivery", placeType: "courier_service" },
  { name: "Szegedi Raktárbázis", city: "Szeged", primaryType: "storage", types: ["storage"], category: "warehouse", placeType: "storage" },
  { name: "Pick szalámigyár", city: "Szeged", primaryType: null, types: ["point_of_interest", "establishment"], category: "factory", placeType: "factory" },
  { name: "Semmelweis Egyetem Fogászati Klinika", city: "Budapest", primaryType: "dental_clinic", types: ["dental_clinic", "dentist", "health"], category: "dental", placeType: "dental_clinic" },
  { name: "Szent János Kórház", city: "Budapest", primaryType: "hospital", types: ["hospital", "health"], category: "healthcare", placeType: "hospital" },
  { name: "Tisza Állatorvosi Rendelő", city: "Szeged", primaryType: "veterinary_care", types: ["veterinary_care"], category: "veterinary", placeType: "veterinary_care" },
  { name: "Cinema City Aréna", city: "Budapest", primaryType: "movie_theater", types: ["movie_theater"], category: "events", placeType: "movie_theater" },
  { name: "Las Vegas Casino", city: "Budapest", primaryType: "casino", types: ["casino"], category: "events", placeType: "casino" },
  { name: "Szegedi Tudományegyetem", city: "Szeged", primaryType: "university", types: ["university", "school"], category: "education", placeType: "university" },
  { name: "Napsugár Óvoda", city: "Szeged", primaryType: "preschool", types: ["preschool", "school"], category: "childcare", placeType: "preschool" },
  { name: "OTP Bank fiók", city: "Szeged", primaryType: "bank", types: ["bank", "atm", "finance"], category: "finance", placeType: "bank" },
  { name: "Szeged 1 posta", city: "Szeged", primaryType: "post_office", types: ["post_office"], category: "public_sector", placeType: "post_office" },
  { name: "Life1 Fitness", city: "Budapest", primaryType: "gym", types: ["gym", "fitness_center"], category: "fitness", placeType: "gym" },
  { name: "Idősek Otthona", city: "Szeged", primaryType: "nursing_home", types: ["nursing_home", "health"], category: "elderly_care", placeType: "nursing_home" },
  // Map data says only "shop": the name decides before the generic type.
  { name: "Borbély Szalon", city: "Szeged", primaryType: "store", types: ["store"], category: "hair", placeType: "barber_shop" },
  // Nothing to go on: the AI is asked.
  { name: "Teszt munkahely", city: "Budapest", primaryType: null, types: [], category: "", placeType: null },
];
