"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useBusinessStatus } from "@/lib/business-status";

export function BriefcaseIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <rect x="3" y="7" width="18" height="13" rx="2.5" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 13h18" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Desktop header: "Business dashboard" for members, "Request in progress" for open requests. */
export function HeaderBusinessLink() {
  const t = useTranslations("BusinessAccess");
  const status = useBusinessStatus();
  if (status?.org) {
    return (
      <Link href="/business" className="hidden items-center gap-2 rounded-lg bg-signal px-3 py-2 text-[15px] font-semibold text-ink lg:inline-flex">
        <BriefcaseIcon className="size-4" />
        {t("open")}
      </Link>
    );
  }
  if (status?.pendingClaim) {
    return (
      <Link href="/business" className="hidden items-center gap-1.5 rounded-lg border border-ink px-3 py-1.5 text-sm font-semibold lg:inline-flex">
        <ClockIcon className="size-4" />
        {t("pending")}
      </Link>
    );
  }
  return null;
}

/** First item of the phone menu, same states as the header link. */
export function MenuBusinessLink() {
  const t = useTranslations("BusinessAccess");
  const status = useBusinessStatus();
  if (!status?.org && !status?.pendingClaim) return null;
  const member = Boolean(status.org);
  return (
    <Link
      href="/business"
      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-lg font-black ${
        member ? "bg-signal text-ink" : "border-2 border-white/30"
      }`}
    >
      {member ? <BriefcaseIcon className="size-6" /> : <ClockIcon className="size-6" />}
      {t(member ? "open" : "pending")}
    </Link>
  );
}

/** "You manage: {org} → Open business dashboard" for members; nothing for everyone else. */
export function ManagedOrgCard({ className = "" }: { className?: string }) {
  const t = useTranslations("BusinessAccess");
  const status = useBusinessStatus();
  if (!status?.org) return null;
  return <OrgCard name={status.org.name} className={className} label={t("managing", { org: status.org.name })} cta={t("openDashboard")} />;
}

export function OrgCard({ name, label, cta, className = "" }: { name: string; label: string; cta: string; className?: string }) {
  return (
    <Link
      href="/business"
      aria-label={`${label} – ${cta}`}
      data-org={name}
      className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-3xl bg-ink p-5 text-paper ${className}`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-signal text-ink">
          <BriefcaseIcon />
        </span>
        <span className="min-w-0 break-words text-lg font-black">{label}</span>
      </span>
      <span className="font-black text-signal">{cta} →</span>
    </Link>
  );
}

/** Employers page buttons: members open their dashboard instead of requesting access. */
export function EmployersCta({ children }: { children: React.ReactNode }) {
  const t = useTranslations("BusinessAccess");
  const status = useBusinessStatus();
  if (!status?.org) return <>{children}</>;
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <Link href="/business" className="inline-flex items-center gap-2 rounded-2xl bg-ink px-6 py-3 text-base font-black text-paper">
        <BriefcaseIcon />
        {t("openDashboard")}
      </Link>
    </div>
  );
}
