"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createWorkplace } from "@/app/[locale]/app/actions";
import { CategorySelect } from "@/components/category-select";
import { COUNTRIES } from "@/lib/countries";

/** `claim`: employer flow – the new workplace goes straight to the claim form. */
type Props = { initialName: string; defaultCountry: string; rateBase: string; claim?: boolean };

export function NewWorkplaceForm({ initialName, defaultCountry, rateBase, claim = false }: Props) {
  const t = useTranslations("NewWorkplace");
  const tn = useTranslations("Countries");
  const [form, setForm] = useState({
    company: initialName,
    address: "",
    city: "",
    country: defaultCountry,
    category: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!claim) {
      // Reviewers: the workplace is created only when the review is sent (after signing in).
      const query = new URLSearchParams(Object.entries(form).filter(([, v]) => v.trim()));
      return router.push(`${rateBase}/pending?${query}`);
    }
    startTransition(async () => {
      const result = await createWorkplace(form);
      if (result.error || !result.id) return setError(t(`errors.${result.error ?? "generic"}`));
      router.push(`${rateBase}/${result.id}`);
    });
  }

  const input =
    "w-full rounded-2xl border border-mist/60 bg-white px-5 py-4 text-lg outline-none focus:border-ink";

  return (
    <form onSubmit={submit} className="mt-6 flex flex-1 flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="font-black">{t("company")}</span>
        <input value={form.company} onChange={set("company")} required maxLength={100} placeholder={t("companyPlaceholder")} className={input} />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-black">{t("address")}</span>
        <input value={form.address} onChange={set("address")} required maxLength={150} placeholder={t("addressPlaceholder")} className={input} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-2">
          <span className="font-black">{t("city")}</span>
          <input value={form.city} onChange={set("city")} required maxLength={80} placeholder={t("cityPlaceholder")} className={input} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-black">{t("country")}</span>
          <select value={form.country} onChange={set("country")} className={input}>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {tn(c)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-2">
        <span className="font-black">{t("category")}</span>
        <CategorySelect
          value={form.category}
          onChange={(category) => setForm((f) => ({ ...f, category }))}
          className={input}
        />
      </label>
      {error && (
        <p role="alert" className="rounded-2xl bg-ink px-4 py-3 font-black text-paper">
          {error}
        </p>
      )}
      <button
        disabled={pending} aria-busy={pending}
        className="mt-auto rounded-2xl bg-ink py-4 text-lg font-black text-paper disabled:opacity-60"
      >
        {t(claim ? "submitClaim" : "submit")}
      </button>
    </form>
  );
}
