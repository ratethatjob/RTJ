"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { submitClaim } from "@/app/[locale]/business/actions";
import { CLAIM_DOC_TYPES, claimDocOk, uploadClaimDocument } from "@/lib/claim-upload";

const METHODS = ["email_domain", "document", "authorization"] as const;

type Props = { locationId: string; userId: string; accountEmail: string };

export function ClaimForm({ locationId, userId, accountEmail }: Props) {
  const t = useTranslations("Business");
  const locale = useLocale();
  const claimId = useRef<string>("");
  const [form, setForm] = useState({
    orgName: "",
    contactName: "",
    jobTitle: "",
    method: "email_domain",
    phone: "",
    website: "",
    note: "",
  });
  const [noWebsite, setNoWebsite] = useState(false);
  // The company document (registry extract or authorization) and the person's photo ID.
  const [file, setFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "sent" | "invalid" | "exists" | "domain" | "generic" | "file">("idle");
  const byEmail = form.method === "email_domain";
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

  function submit() {
    if (!idFile || !claimDocOk(idFile) || (!byEmail && (!file || !claimDocOk(file)))) return setState("file");
    startTransition(async () => {
      claimId.current ||= crypto.randomUUID();
      const idDocumentPath = await uploadClaimDocument(userId, claimId.current, idFile);
      if (!idDocumentPath) return setState("file");
      let documentPath = "";
      if (!byEmail && file) {
        const path = await uploadClaimDocument(userId, claimId.current, file);
        if (!path) return setState("file");
        documentPath = path;
      }
      const result = await submitClaim({
        id: claimId.current,
        locationId,
        ...form,
        noWebsite: byEmail ? false : noWebsite,
        documentPath,
        idDocumentPath,
      });
      setState(result.ok ? "sent" : (result.error ?? "generic"));
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="mt-8 flex flex-col gap-5"
    >
      {field("orgName", t("orgName"), { required: true, maxLength: 120, placeholder: t("orgNamePlaceholder") })}
      {field("contactName", t("contactName"), { required: true, maxLength: 120, autoComplete: "name" })}
      {field("jobTitle", t("jobTitle"), { maxLength: 120, placeholder: t("jobTitlePlaceholder") })}
      {field("phone", t("phone"), { type: "tel", required: true, maxLength: 40, autoComplete: "tel" })}
      <div className="flex flex-col gap-2">
        {field("website", t("website"), {
          type: "text",
          inputMode: "url",
          required: byEmail || !noWebsite,
          disabled: !byEmail && noWebsite,
          maxLength: 200,
          placeholder: t("websitePlaceholder"),
          autoComplete: "url",
        })}
        {!byEmail && (
        <label className="flex items-center gap-3 font-black">
          <input
            type="checkbox"
            checked={noWebsite}
            onChange={(e) => setNoWebsite(e.target.checked)}
            className="size-5 accent-ink"
          />
          {t("noWebsite")}
        </label>
        )}
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-black">{t("method")}</legend>
        {METHODS.map((m) => (
          <label
            key={m}
            className={`flex items-start gap-3 rounded-2xl bg-white px-4 py-4 ${form.method === m ? "border-[3px] border-ink" : "border border-mist/60"}`}
          >
            <input type="radio" name="method" value={m} checked={form.method === m} onChange={set("method")} className="mt-1 size-5 shrink-0 accent-ink" />
            <span>
              <span className="block font-black">{t(`methods.${m}`)}</span>
              <span className="text-sm text-slate">{t(`methodHelp.${m}`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {byEmail && (
        <p className="rounded-2xl bg-white p-4 text-slate">
          {t.rich("accountEmailHint", { email: accountEmail, b: (chunks) => <b className="break-all text-ink">{chunks}</b> })}
        </p>
      )}
      {form.method === "authorization" && (
        <p className="rounded-2xl bg-white p-4">
          <span className="font-black">{t("authorizationForm")}</span>{" "}
          <a href={`/forms/rtj-authorization-${locale}.pdf`} download className="font-black underline underline-offset-4">
            {t("formPdf")}
          </a>
          {" · "}
          <a href={`/forms/rtj-authorization-${locale}.docx`} download className="font-black underline underline-offset-4">
            {t("formDocx")}
          </a>
        </p>
      )}
      {!byEmail && (
        <FileField
          label={t(form.method === "authorization" ? "documentAuthorization" : "documentRegistry")}
          hint={t("documentHint")}
          onChange={setFile}
        />
      )}
      <FileField label={t("idDocument")} hint={`${t("idDocumentHint")} ${t("documentHint")}`} onChange={setIdFile} />
      <label className="flex flex-col gap-2">
        <span className="font-black">{t("note")}</span>
        <textarea value={form.note} onChange={set("note")} rows={3} maxLength={2000} className={input} />
      </label>
      {state !== "idle" && (
        <p role="alert" className="rounded-2xl bg-ink px-4 py-3 font-black text-paper">
          {state === "exists"
            ? t("claimExists")
            : state === "domain"
              ? t("domainError", { email: accountEmail })
              : state === "invalid"
              ? t("claimError")
              : state === "file"
                ? t("documentError")
                  : t("error")}
        </p>
      )}
      <button disabled={pending} className="rounded-2xl bg-ink py-4 text-lg font-black text-paper disabled:opacity-60">
        {t("submitClaim")}
      </button>
    </form>
  );
}

function FileField({ label, hint, onChange }: { label: string; hint: string; onChange: (file: File | null) => void }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-black">{label}</span>
      <span className="text-sm text-slate">{hint}</span>
      <input
        type="file"
        required
        accept={CLAIM_DOC_TYPES.join(",")}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="w-full min-w-0 rounded-2xl border border-mist/60 bg-white px-4 py-3"
      />
    </label>
  );
}
