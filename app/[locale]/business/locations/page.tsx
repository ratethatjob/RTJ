import { Link } from "@/i18n/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ActivatePro } from "@/components/business/activate-pro";
import { ManageBilling, SubscribePro } from "@/components/business/subscribe-pro";
import { PlanBadge } from "@/components/business/plan-badge";
import { TrialBanner } from "@/components/business/trial-banner";
import { daysLeft, getBusiness } from "@/lib/business";
import { SUBSCRIBED_STATUSES } from "@/lib/billing-status";
import { billingCurrency, proPrice } from "@/lib/stripe";

export const instant = false;

const ROLES = ["owner", "hr", "location_manager"] as const;

export default async function LocationsPage({ params, searchParams }: PageProps<"/[locale]/business/locations">) {
  const { locale } = await params;
  const { checkout } = await searchParams;
  setRequestLocale(locale);
  const { supabase, org } = await getBusiness(locale, "/business/locations");
  if (!org) return null;
  const t = await getTranslations("Business");
  const tp = await getTranslations("Plan");
  const tb = await getTranslations("BillingPage.banner");
  const format = await getFormatter();
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });
  const billing = org.role === "owner" || org.role === "hr";
  const cards = Boolean(process.env.STRIPE_SECRET_KEY);
  const money = (country: string, interval: "month" | "year") => {
    const currency = billingCurrency(country);
    return format.number(proPrice(currency, interval), { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0 });
  };
  const subscribed = (l: (typeof org.locations)[number]) =>
    Boolean(l.subscription && SUBSCRIBED_STATUSES.includes(l.subscription.status));

  const { data: members } = await supabase.from("org_members").select("role").eq("org_id", org.id);
  const count = (role: string) => (members ?? []).filter((m) => m.role === role).length;
  const bold = (chunks: React.ReactNode) => <b className="font-black text-paper">{chunks}</b>;

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-brand lg:text-5xl">{t("locationsTitle")}</h1>
          <p className="mt-1 text-slate">{t("locationsBody")}</p>
        </div>
        <Link
          href={{ pathname: "/business/claim", query: { add: "1" } }}
          className="rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm font-black"
        >
          {t("addWorkplace")}
        </Link>
      </div>
      <div className="mt-6">
        <TrialBanner locations={org.locations} />
      </div>

      <section className="mt-6 overflow-x-auto rounded-3xl bg-white">
        <table className="w-full min-w-[720px] text-left">
          <thead className="text-sm uppercase tracking-tagline text-slate">
            <tr className="border-b border-[#E8E6E1]">
              <th className="px-6 py-4 font-black">{t("table.location")}</th>
              <th className="px-6 py-4 font-black">{t("table.plan")}</th>
              <th className="px-6 py-4 font-black">{tp("status")}</th>
              <th className="px-6 py-4 text-right font-black">{billing ? tp("activateColumn") : ""}</th>
            </tr>
          </thead>
          <tbody>
            {org.locations.map((l) => (
              <tr key={l.id} className="border-b border-[#E8E6E1] last:border-0">
                <td className="px-6 py-4">
                  <span className="block font-black">{l.address}</span>
                  <span className="text-slate">
                    {l.city}
                    {l.legalEntityName && ` · ${l.legalEntityName}`}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <PlanBadge plan={l.plan} label={t(`plans.${l.plan}`)} />
                </td>
                <td className="px-6 py-4 text-sm text-slate">
                  {subscribed(l) && l.subscription ? (
                    <span className={l.subscription.status === "past_due" ? "font-black text-ink" : ""}>
                      {l.subscription.status === "past_due"
                        ? tp("paymentFailed")
                        : l.subscription.cancelAtPeriodEnd && l.subscription.periodEnd
                          ? tp("cancelsOn", { date: date(l.subscription.periodEnd) })
                          : l.subscription.status === "trialing" && l.subscription.periodEnd
                            ? tp("firstPaymentOn", { date: date(l.subscription.periodEnd) })
                            : l.subscription.periodEnd
                              ? tp("renewsOn", {
                                  interval: tp(`intervals.${l.subscription.interval === "year" ? "year" : "month"}`),
                                  date: date(l.subscription.periodEnd),
                                })
                              : tp("subscribed")}
                    </span>
                  ) : l.plan === "pro" && l.paidUntil
                    ? tp("paidUntil", { date: date(l.paidUntil) })
                    : l.plan === "trial" && l.trialEndsAt
                      ? tp("trialDays", { days: daysLeft(l.trialEndsAt), date: date(l.trialEndsAt) })
                      : l.trialUsed
                        ? tp("trialEnded")
                        : tp("noPro")}
                </td>
                <td className="px-6 py-4 text-right">
                  {billing &&
                    (subscribed(l) ? (
                      <ManageBilling label={tp("manage")} />
                    ) : cards ? (
                      <SubscribePro
                        locationId={l.id}
                        prices={{ month: money(l.country, "month"), year: money(l.country, "year") }}
                        invoicePending={l.pendingOrder}
                      />
                    ) : (
                      l.plan !== "pro" && <ActivatePro locationId={l.id} pending={l.pendingOrder} />
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section id="team" className="rounded-3xl bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-black tracking-brand">{t("teamTitle")}</h2>
            <Link href="/business/team" className="rounded-xl border-2 border-ink px-4 py-2 font-black">
              {t("inviteMember")}
            </Link>
          </div>
          <ul className="mt-4 flex flex-col gap-3">
            {ROLES.map((r) => (
              <li key={r} className="flex items-start justify-between rounded-2xl bg-paper p-4">
                <span>
                  <span className="block text-lg font-black">{t(`roles.${r}`)}</span>
                  <span className="text-slate">{t(`roleDescriptions.${r}`)}</span>
                </span>
                <span className="font-black">{count(r)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="plan" className="rounded-3xl bg-ink p-6 text-paper">
          <h2 className="text-2xl font-black tracking-brand">{t("planTitle")}</h2>
          <p className="mt-4 font-black text-signal">{tp("trialOffer")}</p>
          <p className="mt-2 text-mist">{t.rich("proIncludes", { b: bold })}</p>
          <p className="mt-2 text-mist">{t.rich("chains", { b: bold })}</p>
          <div className="mt-4 flex flex-col gap-3 border-t border-white/15 pt-4">
            {checkout === "success" && <p className="font-black text-signal">{tp("checkoutSuccess")}</p>}
            <p className="text-sm text-mist">{tp(cards ? "billingNoteCards" : "billingNote")}</p>
            <Link href="/business/billing" className="self-start rounded-xl bg-signal px-4 py-3 text-sm font-black text-ink">
              {tb("cta")}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
