// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { type Component, parseGoogleAddress } from "./place-address.ts";

const c = (longText: string, ...types: string[]): Component => ({ longText, shortText: longText, types });
const HU = { longText: "Magyarország", shortText: "HU", types: ["country", "political"] };

test("full address: street + number, locality", () => {
  const r = parseGoogleAddress({
    formattedAddress: "Budapest, Kazinczy u. 14, 1075 Magyarország",
    addressComponents: [c("14", "street_number"), c("Kazinczy utca", "route"), c("Budapest", "locality", "political"), HU],
  });
  assert.deepEqual(r, { address: "Kazinczy utca 14", city: "Budapest", country: "HU", addressFrom: "street" });
});

test("Budapest shop without a locality (XVIII. kerületi Lidl): city from the district, street without number", () => {
  const r = parseGoogleAddress({
    formattedAddress: "XVIII, XVIII. kerület, Üllői út, Magyarország",
    addressComponents: [c("Üllői út", "route"), c("XVIII. kerület", "sublocality_level_1", "sublocality", "political"), c("XVIII", "administrative_area_level_2", "political"), HU],
  });
  assert.equal(r.city, "Budapest");
  assert.equal(r.address, "Üllői út");
  assert.equal(r.addressFrom, "route");
});

test("Budapest region without locality or district", () => {
  const r = parseGoogleAddress({ addressComponents: [c("Budapest", "administrative_area_level_1", "political"), c("Margó Tivadar utca", "route"), HU] });
  assert.equal(r.city, "Budapest");
  assert.equal(r.address, "Margó Tivadar utca");
});

test("no street (Láng, Csepel): the first meaningful part of the formatted address", () => {
  const r = parseGoogleAddress({
    formattedAddress: "Budapest, Csepel, 1211 Magyarország",
    addressComponents: [c("Csepel", "sublocality_level_2", "sublocality", "political"), c("Budapest", "locality", "political"), HU],
  });
  assert.equal(r.city, "Budapest");
  assert.equal(r.address, "Csepel");
  assert.equal(r.addressFrom, "formatted");
});

test("postcodes, districts, the city and the country are never the address", () => {
  const r = parseGoogleAddress({
    formattedAddress: "1181 Budapest, XVIII. kerület, Magyarország",
    addressComponents: [c("XVIII. kerület", "sublocality_level_1", "sublocality"), c("Budapest", "locality"), HU],
  });
  assert.equal(r.address, "");
  assert.equal(r.city, "Budapest");
});

test("house number first in the US; smaller admin area as the city", () => {
  const r = parseGoogleAddress({
    addressComponents: [c("350", "street_number"), c("5th Avenue", "route"), c("New York County", "administrative_area_level_2"), { longText: "United States", shortText: "US", types: ["country"] }],
  });
  assert.equal(r.address, "350 5th Avenue");
  assert.equal(r.city, "New York County");
});

test("nothing usable", () => {
  assert.deepEqual(parseGoogleAddress({}), { address: "", city: "", country: "", addressFrom: null });
});

test("components without types or texts (Google, Budapest districts) don't break the parsing", () => {
  const r = parseGoogleAddress({
    formattedAddress: "Budapest, Üllői út 661, 1181 Magyarország",
    addressComponents: [
      c("661", "street_number"),
      c("Üllői út", "route"),
      { longText: "XVIII. kerület" } as Component,
      { types: ["political"] } as Component,
      c("Budapest", "administrative_area_level_1"),
      HU,
    ],
  });
  assert.equal(r.city, "Budapest");
  assert.equal(r.address, "Üllői út 661");
});

test("the district as the locality (Lidl, Üllői út 379-381) is Budapest", () => {
  const r = parseGoogleAddress({
    formattedAddress: "XVIII, XVIII. kerület, Üllői út 379-381, Magyarország",
    addressComponents: [c("379-381", "street_number"), c("Üllői út", "route"), c("XVIII. kerület", "sublocality_level_1"), c("XVIII", "locality", "political"), HU],
  });
  assert.equal(r.city, "Budapest");
  assert.equal(r.address, "Üllői út 379-381");
});

test("a component without types (Láng, Csepel): the formatted address is used", () => {
  const r = parseGoogleAddress({
    formattedAddress: "Budapest, Szikratávíró u. hrsz. 210012/11., 1211 Magyarország",
    addressComponents: [{ longText: "Szikratávíró u. hrsz. 210012/11." }, c("Budapest", "locality"), c("XXI. kerület", "sublocality_level_1"), HU, c("1211", "postal_code")],
  });
  assert.equal(r.city, "Budapest");
  assert.equal(r.address, "Szikratávíró u. hrsz. 210012/11.");
  assert.equal(r.addressFrom, "formatted");
});

test("a route that already holds the house number isn't doubled", () => {
  const r = parseGoogleAddress({
    addressComponents: [c("83", "street_number"), c("Margó Tivadar utca 83.", "route"), c("XVIII", "locality"), HU],
  });
  assert.equal(r.address, "Margó Tivadar utca 83");
  assert.equal(r.city, "Budapest");
});
