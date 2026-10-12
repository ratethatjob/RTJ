// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { comparePlaces, distanceM, nameScore, normalizeBusinessName, normalizeStreet, pickMatch, sameAddress } from "./place-match.ts";

test("names: case, accents, company forms and shop formats don't count", () => {
  assert.equal(normalizeBusinessName("LIDL Magyarország Bt."), "lidl");
  assert.equal(normalizeBusinessName("SPAR Szupermarket"), "spar");
  assert.equal(normalizeBusinessName("TESCO Expressz"), "tesco");
  assert.equal(normalizeBusinessName("McDonald’s"), "mcdonalds");
  assert.equal(normalizeBusinessName("McDonald's Nyugati"), "mcdonalds nyugati");
  assert.equal(normalizeBusinessName("Starbucks Coffee"), "starbucks");
  assert.equal(normalizeBusinessName("Kávé Kommandó Kávézó"), "kommando");
  // Only generic words: keep them rather than nothing.
  assert.equal(normalizeBusinessName("Gyógyszertár"), "gyogyszertar");
});

test("name scores", () => {
  assert.equal(nameScore("SPAR", "Spar Szupermarket"), 1);
  assert.equal(nameScore("Tesco Express", "TESCO Expressz"), 1);
  assert.ok(nameScore("Starbucks", "Starbucks Oktogon") >= 0.9);
  assert.ok(nameScore("McDonald's", "McDonald’s Nyugati tér") >= 0.9);
  assert.ok(nameScore("Espresso Embassy", "Espresso Embassy Budapest") >= 0.9);
  // A café spelled a little differently in OpenStreetMap than on Google.
  assert.ok(nameScore("Kávé Kommandó", "Kave Kommando Kávézó") >= 0.5);
  assert.ok(nameScore("Művész Kávéház", "Muvesz Kavehaz") >= 0.5);
  assert.ok(nameScore("Spar", "Penny") < 0.35);
  assert.ok(nameScore("Lidl", "Aldi") < 0.35);
  assert.ok(nameScore("Hair Studio", "Burger Studio") < 0.5);
});

test("streets: abbreviations, postcode and city parts", () => {
  assert.deepEqual(normalizeStreet("Kárász u. 5, 6720 Szeged"), { street: "karasz u", number: "5" });
  assert.deepEqual(normalizeStreet("Kárász utca 5."), { street: "karasz u", number: "5" });
  assert.deepEqual(normalizeStreet("Teréz krt. 41, Budapest, Magyarország"), { street: "terez krt", number: "41" });
  assert.deepEqual(normalizeStreet("Teréz körút 41"), { street: "terez krt", number: "41" });
  assert.deepEqual(normalizeStreet("Váci utca 5/a"), { street: "vaci u", number: "5a" });
  assert.deepEqual(normalizeStreet("Budapest, Andrássy út 12"), { street: "andrassy ut", number: "12" });
  assert.equal(normalizeStreet("Budapest"), null);
  assert.ok(sameAddress("Andrássy út 12", "Andrassy ut 12, Budapest, Hungary"));
  assert.ok(sameAddress("Váci utca 5", "Váci u. 5/A"));
  assert.ok(!sameAddress("Váci utca 5", "Váci utca 7"));
  assert.ok(!sameAddress("Váci utca 5", "Petőfi utca 5"));
});

test("distance", () => {
  // Deák Ferenc tér → Astoria, about 600 m.
  const d = distanceM({ lat: 47.4979, lng: 19.0545 }, { lat: 47.4935, lng: 19.0603 });
  assert.ok(d > 550 && d < 700, String(d));
});

test("chains: the right branch, never one 400 m away", () => {
  // Real Budapest branches (positions rounded): Spar at Nyugati and Spar at Lehel tér.
  const sparNyugati = { name: "SPAR", address: "Teréz krt. 55", lat: 47.5105, lng: 19.0567, brand: "Q610492" };
  const sparLehel = { name: "Spar", address: "Váci út 9-15", lat: 47.5155, lng: 19.0617, brand: "Q610492" };
  const google = { name: "SPAR market", address: "Teréz körút 55, Budapest", lat: 47.51056, lng: 19.05675 };
  assert.equal(comparePlaces(google, sparNyugati).match, "same");
  assert.equal(comparePlaces(google, sparLehel).match, "different");
  assert.equal(pickMatch(google, [sparLehel, sparNyugati]).same, sparNyugati);
  // Search suggestions have no coordinates: name + street and number.
  assert.equal(comparePlaces({ name: "SPAR", address: "Teréz krt. 55, Budapest" }, sparNyugati).match, "same");
  assert.equal(comparePlaces({ name: "SPAR", address: "Váci út 9, Budapest" }, sparNyugati).match, "different");
  // Same brand with a different name in each source (OSM brand tags): still the same place.
  assert.equal(
    comparePlaces({ name: "Lidl Áruház", lat: 47.48, lng: 19.07, brand: "Q151954" }, { name: "LIDL", lat: 47.4802, lng: 19.0701, brand: "Q151954" }).match,
    "same",
  );
});

test("several close candidates: ask, don't guess", () => {
  const mall = { lat: 47.5136, lng: 19.0574 };
  const a = { name: "McDonald's", ...mall };
  const b = { name: "McDonald's WestEnd", lat: 47.5137, lng: 19.0575 };
  const google = { name: "McDonald's", lat: 47.51362, lng: 19.05742 };
  const picked = pickMatch(google, [a, b]);
  assert.equal(picked.same, null);
  assert.equal(picked.maybe.length, 2);
  // Different shops in the same mall are not the same workplace.
  assert.equal(comparePlaces({ name: "Starbucks", ...mall }, { name: "Tesco Expressz", ...mall }).match, "different");
  // A close name in the same spot: "Did you mean …?"
  assert.equal(comparePlaces({ name: "Kávé Kommandó", ...mall }, { name: "Kommandó Café & Bar", ...mall }).match, "same");
  assert.equal(comparePlaces({ name: "Bors GasztroBár", ...mall }, { name: "Bors Bisztró", ...mall }).match, "same");
});
