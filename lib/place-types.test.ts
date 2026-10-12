// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { CATEGORIES } from "./categories.ts";
import { PLACE_EXAMPLES } from "./place-types.fixtures.ts";
import { classifyPlace, normalizeName, PLACE_TYPES, placeTypeLabel, typeFromName, typeFromOsm } from "./place-types.ts";

test("every mapped type has a real category and both labels", () => {
  for (const [type, info] of Object.entries(PLACE_TYPES)) {
    assert.ok((CATEGORIES as readonly string[]).includes(info.category), `${type} → ${info.category}`);
    assert.ok(info.en && info.hu, type);
  }
});

test("real Budapest and Szeged workplaces land in the right category with their exact type", () => {
  assert.ok(PLACE_EXAMPLES.length >= 40);
  for (const ex of PLACE_EXAMPLES) {
    const c = classifyPlace({ name: ex.name, primaryType: ex.primaryType, types: ex.types });
    assert.equal(c.category ?? "", ex.category, ex.name);
    assert.equal(c.placeType, ex.placeType, ex.name);
  }
});

test("names never overrule a specific Google type, office words never point to food", () => {
  // The live bug: a marketing agency became a café because of "Coffee" in its name.
  const agency = classifyPlace({ name: "Creative Coffee Agency", types: ["point_of_interest", "establishment"] });
  assert.equal(agency.category, "office");
  assert.notEqual(agency.certain, true);
  // A specific Google type wins over every word in the name.
  assert.equal(classifyPlace({ name: "Burger Bár", primaryType: "corporate_office", types: [] }).category, "office");
  assert.equal(classifyPlace({ name: "Kávé Kft", primaryType: "point_of_interest", types: ["lawyer"] }).category, "office");
  // A specific type we don't know: no category from the name, the AI or a person decides.
  const unknown = classifyPlace({ name: "Coffee Records", primaryType: "record_store", types: ["record_store"] });
  assert.equal(unknown.category, null);
  // Broad types are refined only within the same family.
  assert.equal(classifyPlace({ name: "Lipóti Pékség", types: ["grocery_store"] }).category, "cafe");
  assert.equal(classifyPlace({ name: "Kávé Ügynökség", types: ["food_store"] }).category, "supermarket");
  // Unclear words stop food/beauty keywords.
  assert.equal(classifyPlace({ name: "Burger Design Studio", types: [] }).category, null);
  assert.equal(classifyPlace({ name: "Hair Design Studio", types: ["hair_salon"] }).category, "hair", "Google decides");
});

test("a barber is a barber, not beauty & wellness", () => {
  const c = classifyPlace({ name: "Barber Shop Budapest Agora", primaryType: "barber_shop", types: ["barber_shop", "hair_care"] });
  assert.equal(c.category, "hair");
  assert.equal(c.certain, true);
  assert.equal(placeTypeLabel(c.placeType, "hu"), "Borbély");
  assert.equal(placeTypeLabel(c.placeType, "en"), "Barber shop");
});

test("order: primary type, other types, name, generic types", () => {
  // The primary type wins over the name.
  assert.equal(classifyPlace({ name: "Barber Café", primaryType: "coffee_shop", types: [] }).category, "cafe");
  // A specific secondary type beats the name; it is only a suggestion.
  const second = classifyPlace({ name: "Kávé és fodrász", primaryType: "point_of_interest", types: ["hair_salon"] });
  assert.deepEqual([second.category, second.source, second.certain], ["hair", "google_types", false]);
  // The name beats a generic type.
  assert.equal(classifyPlace({ name: "Lipóti Pékség", primaryType: "store", types: ["store", "food"] }).category, "cafe");
  // Generic type when the name says nothing.
  const generic = classifyPlace({ name: "Kovács és Társa", primaryType: "store", types: ["store"] });
  assert.deepEqual([generic.category, generic.source], ["retail", "generic"]);
  // Nothing at all: the caller asks the AI.
  assert.equal(classifyPlace({ name: "Teszt munkahely", types: [] }).category, null);
});

test("name keywords: Hungarian without accents, whole words, compounds", () => {
  assert.equal(normalizeName("Borbély-Műhely"), " borbely muhely ");
  assert.equal(typeFromName("BORBÉLY műhely"), "barber_shop");
  assert.equal(typeFromName("Hajvarázs Fodrászat"), "hair_salon");
  assert.equal(typeFromName("Kézi Autómosó"), "car_wash");
  assert.equal(typeFromName("Pick szalámigyár"), "factory");
  assert.equal(typeFromName("Magyar Posta"), "post_office", "magyar is not a factory");
  assert.equal(typeFromName("Barbara Virágbolt"), null, "barbara is not a barber, bar or bara");
  assert.equal(typeFromName("Spartacus Sportklub"), null, "spartacus is not spar");
  assert.equal(typeFromName("Hotel & Spa Aquaworld"), "hotel");
});

test("OpenStreetMap tags use the same types", () => {
  assert.equal(typeFromOsm("shop", "hairdresser"), "hair_salon");
  assert.equal(classifyPlace({ name: "X", osm: { key: "amenity", value: "cafe" } }).category, "cafe");
  assert.equal(classifyPlace({ name: "X", osm: { key: "amenity", value: "veterinary" } }).category, "veterinary");
});
