// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { invoiceFooter as footer, invoiceSeller, taxExemptFor } from "./invoice-tax.ts";
import { OPERATOR } from "./site-config.ts";

const INVOICE_SELLER = invoiceSeller(OPERATOR.taxNumber);
const invoiceFooter = (status: string | null) => footer(status, OPERATOR.taxNumber);

test("tax status from billing country and tax IDs", () => {
  assert.equal(taxExemptFor("HU", ["eu_vat", "hu_tin"]), "reverse");
  assert.equal(taxExemptFor("hu", ["hu_tin"]), "none");
  assert.equal(taxExemptFor("AE", ["ae_trn"]), "none");
  assert.equal(taxExemptFor("GB", ["gb_vat"]), "exempt");
  assert.equal(taxExemptFor("US", []), "exempt");
  assert.equal(taxExemptFor(null, ["eu_vat"]), null);
});

test("every footer starts with the seller line (Meydan, TRN)", () => {
  assert.match(INVOICE_SELLER, /^ABOVO JOBS MENA L\.L\.C-FZ · Meydan Grandstand, Meydan Road, Nad Al Sheba, Dubai, UAE · TRN 105494925800001$/);
  for (const status of ["reverse", "exempt", "none", null] as const) {
    assert.ok(invoiceFooter(status).startsWith(INVOICE_SELLER));
    assert.ok(!invoiceFooter(status).includes("DIFC"));
  }
});

test("legal basis per status", () => {
  assert.match(invoiceFooter("reverse"), /Article 196 of Council Directive 2006\/112\/EC\. \/ Fordított adózás – az ÁFÁ-t a vevő fizeti\.$/);
  assert.match(invoiceFooter("exempt"), /Export of services – outside the scope of UAE VAT \/ zero-rated\. No VAT charged\.$/);
  assert.equal(invoiceFooter("none"), INVOICE_SELLER);
});
