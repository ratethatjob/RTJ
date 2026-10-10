"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { submitClaim } from "@/app/[locale]/business/actions";

const METHODS = ["email_domain", "phone", "document"] as const;

export function ClaimForm({ locationId }: { locationId: string }) {
  const t = useTranslations("Business");
  const [form, setForm] = useState({
    orgName: "",
    contactName: "",
    jobTitle: "",
    method: "email_domain",
    businessEmail: "",
    phone: "",
    note: "",
  });
  const [state, setState] = useState<"idle" | "sent" | "invalid" | "exists" | "generic">("idle");
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  if (state === "sent") {
    return <p className="mt-8 rounded-3xl bg-signal p-6 text-lg font-black">{t("claimSent")}</p>;
  }

  const input = "w-full rounded-2xl border border-mist/60 bg-white px-5 py-4 text-lg outline-none focus:border-ink";
  const field = (key: keyof typeof form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="flex flex-col gap-2">
      <span className="font-black">{label}</span>
      <input value={form[key]} onChange={set(key)} className={input} {...props} />
    </label>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await submitClaim({ locationId, ...form });
          setState(result.ok ? "sent" : (result.error ?? "generic"));
        });
      }}
      className="mt-8 flex flex-col gap-5"
    >
      {field("orgName", t("orgName"), { required: true, maxLength: 120, placeholder: t("orgNamePlaceholder") })}
      {field("contactName", t("contactName"), { required: true, maxLength: 120, autoComplete: "name" })}
      {field("jobTitle", t("jobTitle"), { maxLength: 120, placeholder: t("jobTitlePlaceholder") })}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-black">{t("method")}</legend>
        {METHODS.map((m) => (
          <label key={m} className={`flex items-center gap-3 rounded-2xl bg-white px-4 py-4 font-black ${form.method === m ? "border-[3px] border-ink" : "border border-mist/60"}`}>
            <input type="radio" name="method" value={m} checked={form.method === m} onChange={set("method")} className="size-5 accent-ink" />
            {t(`methods.${m}`)}
          </label>
        ))}
      </fieldset>
      {form.method === "email_domain" &&
        field("businessEmail", t("businessEmail"), { type: "email", required: true, autoComplete: "email" })}
      {form.method === "phone" && field("phone", t("phone"), { type: "tel", required: true, autoComplete: "tel" })}
      <label className="flex flex-col gap-2">
        <span className="font-black">{t("note")}</span>
        <textarea value={form.note} onChange={set("note")} rows={3} maxLength={2000} className={input} />
      </label>
      {state !== "idle" && (
        <p role="alert" className="rounded-2xl bg-ink px-4 py-3 font-black text-paper">
          {state === "exists" ? t("claimExists") : state === "invalid" ? t("claimError") : t("error")}
        </p>
      )}
      <button disabled={pending} className="rounded-2xl bg-ink py-4 text-lg font-black text-paper disabled:opacity-60">
        {t("submitClaim")}
      </button>
    </form>
  );
}
