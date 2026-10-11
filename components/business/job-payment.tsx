"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { payForJob } from "@/app/[locale]/business/billing/actions";
import type { JobTier } from "@/lib/site-config";

/** "Waiting for payment" with a Pay button (Stripe Checkout), or the invoice note without Stripe. */
export function JobPayment({
  jobId,
  tier,
  upgrade,
  returned,
}: {
  jobId: string;
  tier: JobTier;
  upgrade: boolean;
  returned: "success" | "cancelled" | null;
}) {
  const t = useTranslations("BusinessJobs");
  const [state, setState] = useState<"idle" | "invoice" | "error">("idle");
  const [pending, start] = useTransition();
  const pay = () =>
    start(async () => {
      const r = await payForJob(jobId, tier);
      if (r.url) return window.location.assign(r.url);
      setState(r.pending ? "invoice" : "error");
    });
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-ink p-5 text-paper sm:flex-row sm:items-center sm:justify-between">
      <p className="font-black">
        {returned === "success"
          ? t("payment.processing")
          : state === "invoice"
            ? t("payment.invoice")
            : upgrade
              ? t("payment.upgradeWaiting", { tier: t(`packages.${tier}.name`) })
              : t("payment.waiting")}
      </p>
      {returned !== "success" && state !== "invoice" && (
        <span className="flex items-center gap-3">
          {state === "error" && <span className="text-sm font-black text-mist">{t("error")}</span>}
          <button
            type="button"
            disabled={pending}
            onClick={pay}
            className="shrink-0 rounded-2xl bg-signal px-5 py-2.5 font-black text-ink disabled:opacity-60"
          >
            {t("payment.pay")}
          </button>
        </span>
      )}
    </div>
  );
}
