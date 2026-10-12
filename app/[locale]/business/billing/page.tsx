import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { BillingAccount } from "@/components/business/billing-account";
import { BillingCard } from "@/components/business/billing-card";
import { loadBillingData } from "@/lib/billing-data";
import { billingView, yearlySavingPercent } from "@/lib/billing-status";
import { getBusiness } from "@/lib/business";
import { billingCurrency, proPrice } from "@/lib/stripe";
import { localeCurrency } from "@/lib/site-config";

export const instant = false;

// Subscription page: one card per location (state, days left, next charge, card, buttons) and,
// for owners and HR, the billing details and latest invoices from Stripe.
export default async function BillingPage({ params, searchParams }: PageProps<"/[locale]/business/billing">) {
  const { locale } = await params;
  const { checkout } = await searchParams;
  setRequestLocale(locale);
  const { org } = await getBusiness(locale, "/business/billing");
  if (!org) return null;
  const t = await getTranslations("BillingPage");
  const tPlan = await getTranslations("Plan");
  const format = await getFormatter();
  const canManage = org.role === "owner" || org.role === "hr";
  const data = canManage
    ? await loadBillingData(org.id, org.locations.map((l) => l.id))
    : { details: null, invoices: [], subscriptions: new Map() };

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-4xl font-black tracking-brand lg:text-5xl">{t("title")}</h1>
        <p className="mt-1 text-slate">{t("intro")}</p>
      </div>
      {checkout === "success" && (
        <p role="status" className="rounded-2xl bg-signal p-4 font-black text-ink">
          {t("checkoutSuccess")}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {org.locations.map((l) => {
          const currency = billingCurrency(l.country);
          const price = (interval: "month" | "year") =>
            format.number(proPrice(currency, interval), {
              style: "currency",
              currency: currency.toUpperCase(),
              maximumFractionDigits: 0,
            });
          return (
            <BillingCard
              key={l.id}
              location={{ id: l.id, name: l.name, address: `${l.address}, ${l.city}` }}
              view={billingView(
                {
                  trialStartedAt: l.trialStartedAt,
                  trialEndsAt: l.trialEndsAt,
                  paidUntil: l.paidUntil,
                  stripeStatus: l.subscription?.status ?? null,
                  periodEnd: l.subscription?.periodEnd ?? null,
                  cancelAtPeriodEnd: l.subscription?.cancelAtPeriodEnd ?? false,
                },
              )}
              info={data.subscriptions.get(l.id) ?? null}
              canManage={canManage}
              invoicePending={l.pendingOrder}
              prices={{ month: price("month"), year: price("year") }}
              currencyNote={
                currency.toUpperCase() !== localeCurrency(locale) ? tPlan("currencyNote", { currency: currency.toUpperCase() }) : undefined
              }
              savingPercent={yearlySavingPercent(proPrice(currency, "month"), proPrice(currency, "year"))}
            />
          );
        })}
      </div>
      {canManage && org.billingAccount && (
        <BillingAccount details={data.details} invoices={data.invoices} canManage={canManage} />
      )}
    </main>
  );
}
