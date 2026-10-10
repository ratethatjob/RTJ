"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { purgeDemo } from "@/app/[locale]/admin/actions";

export function PurgeDemo({ disabled }: { disabled: boolean }) {
  const t = useTranslations("Admin.demo");
  const router = useRouter();
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => {
          if (!window.confirm(t("confirm"))) return;
          startTransition(async () => {
            setError(false);
            const result = await purgeDemo();
            if (result.error) return setError(true);
            router.refresh();
          });
        }}
        className="rounded-2xl bg-ink px-5 py-3 font-black text-paper disabled:opacity-40"
      >
        {pending ? t("purging") : t("purge")}
      </button>
      {error && <p className="font-black">{t("error")}</p>}
    </div>
  );
}
