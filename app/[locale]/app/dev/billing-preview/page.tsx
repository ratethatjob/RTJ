import { notFound } from "next/navigation";
import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";
import { BillingAccount } from "@/components/business/billing-account";
import { BillingCard, type BillingCardProps } from "@/components/business/billing-card";
import { TrialBanner } from "@/components/business/trial-banner";
import { billingView, type PlanFacts } from "@/lib/billing-status";
import type { BusinessLocation } from "@/lib/business";

export const instant = false;

// Every Subscription page state with made-up data, for screenshots and design checks.
// Only when RTJ_BILLING_PREVIEW=1 (never set in production); otherwise 404.
export default async function BillingPreviewPage({ params }: PageProps<"/[locale]/app/dev/billing-preview">) {
  await connection();
  if (process.env.RTJ_BILLING_PREVIEW !== "1") notFound();
  const { locale } = await params;
  setRequestLocale(locale);
  const now = previewClock();
  const day = (n: number) => new Date(now + n * 86_400_000).toISOString();
  const facts = (p: Partial<PlanFacts>): PlanFacts => ({
    trialStartedAt: null, trialEndsAt: null, paidUntil: null, stripeStatus: null, periodEnd: null, cancelAtPeriodEnd: false, ...p,
  });
  const card = { brand: "visa", last4: "4242", expMonth: 8, expYear: 2028 };
  const huf = { month: "12 900 Ft", year: "129 000 Ft" };
  const base = { canManage: true, invoicePending: null, prices: huf, savingPercent: 17 } as const;
  const cards: (BillingCardProps & { key: string })[] = [
    { key: "trial", location: { id: "1", name: "Placeholder Bistro", address: "Andrássy út 12, Budapest" }, view: billingView(facts({ trialStartedAt: day(-12), trialEndsAt: day(18) }), now), info: null, ...base },
    { key: "trial-soon", location: { id: "2", name: "Placeholder Bistro", address: "Király utca 3, Budapest" }, view: billingView(facts({ trialStartedAt: day(-27), trialEndsAt: day(3) }), now), info: null, ...base },
    { key: "trial-subscribed", location: { id: "3", name: "Sample Supermarket", address: "Váci út 12, Budapest" }, view: billingView(facts({ trialStartedAt: day(-20), trialEndsAt: day(10), stripeStatus: "trialing", periodEnd: day(10) }), now), info: { amount: 12900, currency: "huf", interval: "month", nextAmount: 12900, nextChargeAt: day(10), card }, ...base },
    { key: "active", location: { id: "4", name: "Sample Supermarket", address: "Bartók Béla út 5, Budapest" }, view: billingView(facts({ trialStartedAt: day(-90), trialEndsAt: day(-60), stripeStatus: "active", periodEnd: day(21), paidUntil: day(21) }), now), info: { amount: 12900, currency: "huf", interval: "month", nextAmount: 12900, nextChargeAt: day(21), card }, ...base },
    { key: "canceling", location: { id: "5", name: "Example Logistics Hub", address: "Gyár utca 1, Szeged" }, view: billingView(facts({ trialStartedAt: day(-200), trialEndsAt: day(-170), stripeStatus: "active", periodEnd: day(40), paidUntil: day(40), cancelAtPeriodEnd: true }), now), info: { amount: 129000, currency: "huf", interval: "year", nextAmount: null, nextChargeAt: null, card }, ...base },
    { key: "past-due", location: { id: "6", name: "Mock Office Co", address: "Fő tér 2, Debrecen" }, view: billingView(facts({ trialStartedAt: day(-100), trialEndsAt: day(-70), stripeStatus: "past_due", periodEnd: day(28), paidUntil: day(-2) }), now), info: { amount: 12900, currency: "huf", interval: "month", nextAmount: 12900, nextChargeAt: day(28), card }, ...base },
    { key: "expired", location: { id: "7", name: "Mock Office Co", address: "Kossuth tér 9, Pécs" }, view: billingView(facts({ trialStartedAt: day(-45), trialEndsAt: day(-15) }), now), info: null, ...base },
    { key: "free", location: { id: "8", name: "Placeholder Bistro", address: "Dob utca 4, Budapest" }, view: billingView(facts({}), now), info: null, ...base },
  ];
  const loc = (id: string, p: Partial<BusinessLocation>) =>
    ({ id, trialStartedAt: null, trialEndsAt: null, paidUntil: null, subscription: null, trialUsed: false, ...p }) as BusinessLocation;
  const banners: { key: string; locations: BusinessLocation[] }[] = [
    { key: "banner-trial", locations: [loc("a", { trialStartedAt: day(-5), trialEndsAt: day(25), trialUsed: true })] },
    { key: "banner-ending", locations: [loc("b", { trialStartedAt: day(-28), trialEndsAt: day(2), trialUsed: true })] },
    { key: "banner-failed", locations: [loc("c", { subscription: { status: "past_due", periodEnd: day(20), cancelAtPeriodEnd: false, interval: "month" } })] },
  ];

  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
        {banners.map((b) => (
          <div key={b.key} id={b.key}>
            <TrialBanner locations={b.locations} />
          </div>
        ))}
        {cards.map(({ key, ...props }) => (
          <div key={key} id={key}>
            <BillingCard {...props} />
          </div>
        ))}
        <div id="account">
          <BillingAccount
            canManage
            details={{ name: "Placeholder Kft.", address: ["Andrássy út 12.", "1061 Budapest", "HU"], taxIds: [{ type: "eu_vat", value: "HU12345678" }] }}
            invoices={[
              { id: "in_1", number: "RTJ-0003", date: day(-9), total: 12900, currency: "huf", status: "paid", pdf: "#", url: "#" },
              { id: "in_2", number: "RTJ-0002", date: day(-39), total: 12900, currency: "huf", status: "open", pdf: "#", url: "#" },
              { id: "in_3", number: "RTJ-0001", date: day(-69), total: 39, currency: "eur", status: "paid", pdf: "#", url: "#" },
            ]}
          />
        </div>
      </main>
    </>
  );
}

/** The preview's "now" (outside render, so every state is relative to the request time). */
function previewClock() {
  return Date.now();
}
