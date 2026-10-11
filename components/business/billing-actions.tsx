"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { openBillingPortal, type PortalFlow, reactivatePro } from "@/app/[locale]/business/billing/actions";

const button = {
  primary: "rounded-xl bg-ink px-4 py-3 text-sm font-black text-paper disabled:opacity-50",
  secondary: "rounded-xl border-2 border-ink px-4 py-3 text-sm font-black disabled:opacity-50",
  danger: "rounded-xl bg-[#C8323C] px-4 py-3 text-sm font-black text-white disabled:opacity-50",
  quiet: "px-1 py-3 text-sm font-black underline underline-offset-4 disabled:opacity-50",
};

/** Opens the Stripe Customer Portal in one flow (card, cancel, yearly) or at its home (invoices). */
export function PortalButton({
  flow,
  locationId,
  label,
  look = "secondary",
}: {
  flow: PortalFlow;
  locationId?: string;
  label: string;
  look?: keyof typeof button;
}) {
  const t = useTranslations("BillingPage");
  const [error, setError] = useState(false);
  const [busy, start] = useTransition();
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={busy} aria-busy={busy}
        onClick={() =>
          start(async () => {
            setError(false);
            const r = await openBillingPortal(flow, locationId);
            if (r.url) return window.location.assign(r.url);
            setError(true);
          })
        }
        className={button[look]}
      >
        {label}
      </button>
      {error && <span className="text-sm font-black">{t("error")}</span>}
    </span>
  );
}

/** Takes back "cancel at the period end". */
export function ReactivateButton({ locationId }: { locationId: string }) {
  const t = useTranslations("BillingPage");
  const router = useRouter();
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const [busy, start] = useTransition();
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={busy || state === "done"} aria-busy={busy}
        onClick={() =>
          start(async () => {
            const r = await reactivatePro(locationId);
            setState(r.ok ? "done" : "error");
            if (r.ok) router.refresh();
          })
        }
        className={button.primary}
      >
        {t("reactivate")}
      </button>
      {state !== "idle" && (
        <span role="status" className="text-sm font-black">
          {t(state === "done" ? "reactivated" : "error")}
        </span>
      )}
    </span>
  );
}
