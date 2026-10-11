import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { billingView } from "@/lib/billing-status";
import type { BusinessLocation } from "@/lib/business";

/** Top of the dashboard: a failed payment, a trial (sooner than 7 days: louder), or a trial that
 *  ended unpaid. Subscribed trials need nothing. Each links to the Subscription page. */
export async function TrialBanner({ locations }: { locations: BusinessLocation[] }) {
  const t = await getTranslations("Plan");
  const tb = await getTranslations("BillingPage.banner");
  const views = locations.map((l) =>
    billingView(
      {
        trialStartedAt: l.trialStartedAt,
        trialEndsAt: l.trialEndsAt,
        paidUntil: l.paidUntil,
        stripeStatus: l.subscription?.status ?? null,
        periodEnd: l.subscription?.periodEnd ?? null,
        cancelAtPeriodEnd: l.subscription?.cancelAtPeriodEnd ?? false,
      },
    ),
  );
  const failed = views.filter((v) => v.state === "past_due");
  const trials = views.filter((v) => v.state === "trial" && !v.subscribed && v.daysLeft !== null);
  const expired = locations.filter((_, i) => views[i].state === "expired" && locations[i].trialUsed);
  const days = trials.length ? Math.min(...trials.map((v) => v.daysLeft!)) : null;
  if (!failed.length && days === null && !expired.length) return null;

  const cta = (dark: boolean) => (
    <Link
      href="/business/billing"
      className={`shrink-0 self-start rounded-2xl px-5 py-3 font-black sm:self-center ${dark ? "bg-signal text-ink" : "bg-ink text-paper"}`}
    >
      {tb("cta")}
    </Link>
  );

  return (
    <div className="flex flex-col gap-3">
      {failed.length > 0 && (
        <section role="alert" className="flex flex-col gap-3 rounded-3xl bg-[#C8323C] p-5 text-white sm:flex-row sm:items-center sm:justify-between">
          <p className="text-lg font-black">{tb("pastDue", { count: failed.length })}</p>
          {cta(false)}
        </section>
      )}
      {days !== null &&
        (days <= 7 ? (
          <section className="flex flex-col gap-3 rounded-3xl bg-ink p-5 text-paper sm:flex-row sm:items-center sm:justify-between">
            <p className="text-lg font-black">{tb("ending", { days, count: trials.length })}</p>
            {cta(true)}
          </section>
        ) : (
          <section className="flex flex-col gap-3 rounded-3xl border border-mist/60 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-black">{tb("trial", { days, count: trials.length })}</p>
            {cta(false)}
          </section>
        ))}
      {expired.length > 0 && (
        <section className="flex flex-col gap-3 rounded-3xl border-2 border-ink bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-black">{t("endedTitle", { count: expired.length })}</p>
            <p className="text-slate">{t("endedBody")}</p>
          </div>
          {cta(false)}
        </section>
      )}
    </div>
  );
}

/** Shown instead of a Pro feature when the location has no trial or paid Pro. */
export async function ProGate({ feature }: { feature: "index" | "stats" }) {
  const t = await getTranslations("Plan");
  return (
    <section className="flex flex-col items-start gap-3 rounded-3xl bg-ink p-6 text-paper">
      <p className="text-sm font-black uppercase tracking-tagline text-mist">Pro</p>
      <h2 className="text-2xl font-black tracking-brand">{t(`gate.${feature}Title`)}</h2>
      <p className="text-mist">{t(`gate.${feature}Body`)}</p>
      <Link href="/business/billing" className="rounded-2xl bg-signal px-5 py-3 font-black text-ink">
        {t("activate")}
      </Link>
    </section>
  );
}
