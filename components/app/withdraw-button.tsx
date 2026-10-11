"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { withdrawApplication } from "@/app/[locale]/app/apply/actions";

export function WithdrawButton({ id }: { id: string }) {
  const t = useTranslations("Applications");
  const router = useRouter();
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button
        type="button"
        disabled={pending} aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await withdrawApplication(id);
            if (result.error) return setError(true);
            router.refresh();
          })
        }
        className="font-black underline underline-offset-4 disabled:opacity-60"
      >
        {t("withdraw")}
      </button>
      {error && <span className="text-slate">{t("error")}</span>}
    </>
  );
}
