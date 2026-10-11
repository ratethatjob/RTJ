"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { syncStripeInvoices } from "@/app/[locale]/admin/actions";
import type { InvoiceCheck } from "@/lib/stripe";

/** "Sync invoice settings": runs the Stripe sync for every customer and shows the result. */
export function StripeInvoiceCheck() {
  const t = useTranslations("Admin.invoiceCheck");
  const format = useFormatter();
  const [rows, setRows] = useState<InvoiceCheck[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, start] = useTransition();
  return (
    <section className="mt-8 flex flex-col gap-3 rounded-3xl bg-white p-5">
      <h2 className="text-lg font-black">{t("title")}</h2>
      <p className="text-sm text-slate">{t("body")}</p>
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        onClick={() =>
          start(async () => {
            const r = await syncStripeInvoices();
            setError(Boolean(r.error));
            setRows(r.rows ?? null);
          })
        }
        className="self-start rounded-xl bg-ink px-4 py-3 text-sm font-black text-paper disabled:opacity-50"
      >
        {t("run")}
      </button>
      {error && <p className="font-black">{t("error")}</p>}
      {rows && rows.length === 0 && <p className="text-slate">{t("none")}</p>}
      {rows?.map((r) => (
        <article key={r.customerId} className="rounded-2xl border border-mist/60 p-4">
          <p className="font-black">
            {r.orgName} · {r.customerId} · tax_exempt: {r.taxExempt ?? "–"}
          </p>
          <p className="mt-1 whitespace-pre-line text-sm">{r.footer}</p>
          {r.next.length === 0 && <p className="mt-2 text-sm text-slate">{t("noNext")}</p>}
          {r.next.map((n, i) => (
            <div key={i} className="mt-2 rounded-xl bg-paper p-3 text-sm">
              <p className="font-black">
                {t("next", {
                  date: n.date ? format.dateTime(new Date(n.date), { dateStyle: "medium" }) : "–",
                  amount: format.number(n.amountDue / 100, { style: "currency", currency: n.currency.toUpperCase() }),
                })}
                {" · "}
                {t(n.accountTaxIds ? "trnYes" : "trnNo")}
              </p>
              <p className="mt-1 whitespace-pre-line">{n.footer ?? t("noFooter")}</p>
            </div>
          ))}
        </article>
      ))}
    </section>
  );
}
