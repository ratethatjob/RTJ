import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { type BusinessLocation, daysLeft } from "@/lib/business";

/** Trial countdown, or a warning once a trial ended unpaid (embedded Index shows "unavailable"). */
export async function TrialBanner({ locations }: { locations: BusinessLocation[] }) {
  const t = await getTranslations("Plan");
  const trials = locations.filter((l) => l.plan === "trial" && l.trialEndsAt);
  const ended = locations.filter((l) => l.trialUsed && !l.pro);
  if (!trials.length && !ended.length) return null;
  const soonest = trials.map((l) => l.trialEndsAt!).sort()[0];

  return (
    <div className="flex flex-col gap-3">
      {ended.length > 0 && (
        <section className="flex flex-col gap-3 rounded-3xl border-2 border-ink bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-black">{t("endedTitle", { count: ended.length })}</p>
            <p className="text-slate">{t("endedBody")}</p>
          </div>
          <Link href="/business/locations#plan" className="shrink-0 rounded-2xl bg-ink px-5 py-3 font-black text-paper">
            {t("activate")}
          </Link>
        </section>
      )}
      {soonest && (
        <section className="flex flex-col gap-3 rounded-3xl bg-ink p-5 text-paper sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-black">{t("trialLeft", { days: daysLeft(soonest) })}</p>
            <p className="text-mist">{t("trialBody")}</p>
          </div>
          <Link href="/business/locations#plan" className="shrink-0 rounded-2xl bg-signal px-5 py-3 font-black text-ink">
            {t("activate")}
          </Link>
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
      <Link href="/business/locations#plan" className="rounded-2xl bg-signal px-5 py-3 font-black text-ink">
        {t("activate")}
      </Link>
    </section>
  );
}
