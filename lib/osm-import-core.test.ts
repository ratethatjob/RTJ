// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  boundaryRings,
  groupTags,
  insideRings,
  OSM_CITIES,
  OSM_GROUPS,
  osmCity,
  osmGroup,
  overpassQuery,
  rowFromElement,
  rowsFromElements,
  addressFromReverse,
  type OsmElement,
} from "./osm-import-core.ts";
import { typeFromOsm } from "./place-types.ts";

const szeged = osmCity("szeged")!;
const food = osmGroup("food")!;
const retail = osmGroup("retail")!;
const grocery = osmGroup("grocery")!;
const node = (id: number, tags: Record<string, string>, lat = 46.2525, lon = 20.1486): OsmElement => ({ type: "node", id, lat, lon, tags });

test("every imported tag has a type and a category", () => {
  for (const g of OSM_GROUPS) {
    for (const tag of groupTags(g)) {
      const [k, v] = tag.split("=");
      assert.ok(typeFromOsm(k, v), tag);
    }
  }
  assert.equal(OSM_CITIES.length, 11);
});

test("queries are small bbox queries", () => {
  const q = overpassQuery(szeged, food);
  assert.match(q, /^\[out:json\]\[timeout:25\]\[bbox:46\.18,19\.97,46\.35,20\.28\];/);
  assert.match(q, /nwr\[name\]\["amenity"~"\^\(restaurant\|fast_food\|cafe/);
  assert.ok(!q.includes("area"));
});

test("rows: name, address and type; chains by brand", () => {
  const spar = rowFromElement(
    node(1, { shop: "supermarket", name: "SPAR", brand: "Spar", "brand:wikidata": "Q610492", "addr:street": "Kárász utca", "addr:housenumber": "5", phone: "+36 1 234 5678" }),
    grocery,
    szeged,
    null,
  );
  assert.ok(typeof spar !== "string");
  assert.equal(spar.company, "Spar");
  assert.equal(spar.brand_wikidata, "Q610492");
  assert.equal(spar.address, "Kárász utca 5");
  assert.equal(spar.city, "Szeged");
  assert.equal(spar.category, "supermarket");
  assert.equal(spar.osm_tag, "shop=supermarket");
  // Never any contact data.
  assert.ok(!JSON.stringify(spar).includes("234"));

  const cafe = rowFromElement(node(2, { amenity: "cafe", name: "Kávé Kommandó", "addr:street": "Fő utca", "addr:housenumber": "1" }), food, szeged, null);
  assert.ok(typeof cafe !== "string");
  assert.equal(cafe.company, "Kávé Kommandó");
  assert.equal(cafe.chain, false);
  assert.equal(cafe.category, "cafe");
});

test("skipped: closed, private persons, no address, outside the city", () => {
  const addr = { "addr:street": "Fő utca", "addr:housenumber": "1" };
  assert.equal(rowFromElement(node(3, { amenity: "cafe", ...addr }), food, szeged, null), "no_name");
  assert.equal(rowFromElement(node(4, { "disused:amenity": "cafe", amenity: "cafe", name: "Régi", ...addr }), food, szeged, null), "closed");
  assert.equal(rowFromElement(node(5, { amenity: "cafe", name: "Bezárt", opening_hours: "closed", ...addr }), food, szeged, null), "closed");
  assert.equal(rowFromElement(node(6, { amenity: "restaurant", name: "Dr. Kovács Étterem", ...addr }), food, szeged, null), "person");
  assert.equal(rowFromElement(node(7, { amenity: "cafe", name: "Cím nélkül" }), food, szeged, null), "no_address");
  const square: [number, number][] = [[46.2, 20.1], [46.2, 20.2], [46.3, 20.2], [46.3, 20.1], [46.2, 20.1]];
  assert.equal(rowFromElement(node(8, { amenity: "cafe", name: "Kint", ...addr }, 46.1, 20.15), food, szeged, [square]), "outside");
  assert.ok(typeof rowFromElement(node(9, { amenity: "cafe", name: "Bent", ...addr }), food, szeged, [square]) !== "string");
});

test("the same shop drawn twice is imported once", () => {
  const addr = { "addr:street": "Fő utca", "addr:housenumber": "1" };
  const { rows, skipped } = rowsFromElements(
    [
      node(10, { amenity: "cafe", name: "Fekete Kávézó", ...addr }),
      { type: "way", id: 11, center: { lat: 46.25251, lon: 20.14861 }, tags: { amenity: "cafe", name: "Fekete", ...addr } },
      node(10, { amenity: "cafe", name: "Fekete Kávézó", ...addr }),
      node(12, { amenity: "cafe", ...addr }),
    ],
    food,
    szeged,
    null,
  );
  assert.equal(rows.length, 1);
  assert.equal(skipped.duplicate, 2);
  assert.equal(skipped.no_name, 1);
});

test("boundary rings are joined from ways, reversed where needed", () => {
  const g = (pts: [number, number][]) => pts.map(([lat, lon]) => ({ lat, lon }));
  const rel: OsmElement = {
    type: "relation",
    id: 1,
    members: [
      { type: "way", role: "outer", geometry: g([[0, 0], [0, 10]]) },
      { type: "way", role: "outer", geometry: g([[10, 10], [0, 10]]) },
      { type: "way", role: "outer", geometry: g([[10, 10], [10, 0], [0, 0]]) },
    ],
  };
  const rings = boundaryRings(rel);
  assert.equal(rings.length, 1);
  assert.ok(insideRings(rings, 5, 5));
  assert.ok(!insideRings(rings, 15, 5));
});

test("descriptions are not names; unaddressed places kept only on request", () => {
  const addr = { "addr:street": "Fő utca", "addr:housenumber": "1" };
  assert.equal(rowFromElement(node(20, { shop: "optician", name: "magán szemészeti központ", ...addr }), retail, szeged, null), "no_name");
  assert.ok(typeof rowFromElement(node(21, { shop: "bicycle", name: "ebikeshop", ...addr }), retail, szeged, null) !== "string");
  const kept = rowFromElement(node(22, { amenity: "cafe", name: "Cím nélkül" }), food, szeged, null, true);
  assert.ok(typeof kept !== "string" && kept.address === "");
  const { rows, unaddressed, skipped } = rowsFromElements(
    [node(23, { amenity: "cafe", name: "Van címe", ...addr }), node(24, { amenity: "cafe", name: "Nincs címe" }, 46.26, 20.15)],
    food,
    szeged,
    null,
    true,
  );
  assert.equal(rows.length, 1);
  assert.equal(unaddressed.length, 1);
  assert.equal(skipped.no_address, 1);
});

test("address from a reverse geocoding answer", () => {
  assert.equal(addressFromReverse({ address: { road: "Kárász utca", house_number: "9" } }), "Kárász utca 9");
  assert.equal(addressFromReverse({ address: { pedestrian: "Klauzál tér" } }), "Klauzál tér");
  assert.equal(addressFromReverse({ address: { suburb: "Belváros", city: "Szeged" } }), null);
  assert.equal(addressFromReverse(null), null);
});
