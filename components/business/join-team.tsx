"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { acceptMemberInvite } from "@/app/[locale]/business/team/actions";
import { useRouter } from "@/i18n/navigation";

export function JoinTeam({ token }: { token: string }) {
  const t = useTranslations("Team");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={pending} aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await acceptMemberInvite(token);
            if (result.error) {
              return setError(
                result.error === "otherOrg" ? t("otherOrg") : result.error === "invalid" ? t("invalid") : t("error"),
              );
            }
            router.push("/business");
            router.refresh();
          })
        }
        className="rounded-2xl bg-ink px-5 py-3 text-base font-black text-paper disabled:opacity-60"
      >
        {t("join")}
      </button>
      {error && <p className="font-black">{error}</p>}
    </div>
  );
}
