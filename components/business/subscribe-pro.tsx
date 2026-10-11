"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { openBillingPortal, startProCheckout } from "@/app/[locale]/business/billing/actions";
import { ActivatePro } from "@/components/business/activate-pro";

/** Pro by card (Stripe Checkout, monthly or yearly), or by invoice as before. */
export function SubscribePro({
  locationId,
  prices,
  invoicePending,
}: {
  locationId: string;
  prices: { month: string; year: string };
  invoicePending: "month" | "year" | null;
}) {
  const t = useTranslations("Plan");
  const [error, setError] = useState(false);
  const [invoice, setInvoice] = useState(Boolean(invoicePending));
  const [busy, start] = useTransition();

  if (invoice) return <ActivatePro locationId={locationId} pending={invoicePending} />;
  const go = (interval: "month" | "year") =>
    start(async () => {
      setError(false);
      const r = await startProCheckout(locationId, interval);
      if (r.url) return window.location.assign(r.url);
      setError(true);
    });
  return (
    <span className="flex flex-col items-end gap-2">
      <span className="flex flex-wrap justify-end gap-2">
        {(["month", "year"] as const).map((i) => (
          <button
            key={i}
            type="button"
            disabled={busy}
            onClick={() => go(i)}
            className={`rounded-xl px-3 py-2 text-sm font-black disabled:opacity-50 ${
              i === "year" ? "bg-ink text-paper" : "border-2 border-ink"
            }`}
          >
            {t(`subscribe_${i}`, { price: prices[i] })}
          </button>
        ))}
      </span>
      <button type="button" onClick={() => setInvoice(true)} className="text-sm font-black underline underline-offset-4">
        {t("payByInvoice")}
      </button>
      {error && <span className="text-sm font-black">{t("error")}</span>}
    </span>
  );
}

/** Stripe Customer Portal: card, invoices, billing details, cancellation. */
export function ManageBilling({ label, dark = false }: { label: string; dark?: boolean }) {
  const t = useTranslations("Plan");
  const [error, setError] = useState(false);
  const [busy, start] = useTransition();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          start(async () => {
            setError(false);
            const r = await openBillingPortal();
            if (r.url) return window.location.assign(r.url);
            setError(true);
          })
        }
        className={`rounded-xl px-3 py-2 text-sm font-black disabled:opacity-50 ${
          dark ? "bg-signal text-ink" : "border-2 border-ink"
        }`}
      >
        {label}
      </button>
      {error && <span className="text-sm font-black">{t("error")}</span>}
    </span>
  );
}
