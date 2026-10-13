// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { fromNominatim, fromPhoton, nominatimQuery, photonQuery } from "./geocode-core.ts";

const w = { address: " Kazinczy utca 14 ", city: "Budapest", country: "HU" };

test("queries: structured street + city in one country", () => {
  const q = nominatimQuery(w);
  assert.equal(q.get("street"), "Kazinczy utca 14");
  assert.equal(q.get("city"), "Budapest");
  assert.equal(q.get("countrycodes"), "hu");
  assert.equal(q.get("limit"), "1");
  assert.equal(photonQuery(w).get("q"), "Kazinczy utca 14, Budapest");
});

test("nominatim: first hit, right country only", () => {
  assert.deepEqual(fromNominatim([{ lat: "47.4969", lon: "19.0631", address: { country_code: "hu" } }], w), { lat: 47.4969, lng: 19.0631 });
  assert.equal(fromNominatim([{ lat: "48.2", lon: "16.3", address: { country_code: "at" } }], w), null);
  assert.equal(fromNominatim([], w), null);
  assert.equal(fromNominatim([{ lat: "x", lon: "19" }], w), null);
  assert.equal(fromNominatim([{ lat: "0", lon: "0" }], w), null);
});

test("photon: right country and city, accents ignored", () => {
  const data = {
    features: [
      { geometry: { coordinates: [20.1, 46.2] as [number, number] }, properties: { countrycode: "HU", city: "Szeged" } },
      { geometry: { coordinates: [19.0631, 47.4969] as [number, number] }, properties: { countrycode: "HU", city: "Budapest" } },
    ],
  };
  assert.deepEqual(fromPhoton(data, w), { lat: 47.4969, lng: 19.0631 });
  assert.equal(fromPhoton(data, { ...w, city: "Pécs" }), null);
  assert.deepEqual(
    fromPhoton({ features: [{ geometry: { coordinates: [18.23, 46.07] }, properties: { countrycode: "HU", city: "Pecs" } }] }, { ...w, city: "Pécs" }),
    { lat: 46.07, lng: 18.23 },
  );
  assert.equal(fromPhoton({}, w), null);
});
