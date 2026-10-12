import { getFormatter, getTranslations } from "next-intl/server";
import { PortalButton, ReactivateButton } from "@/components/business/billing-actions";
import { SubscribePro } from "@/components/business/subscribe-pro";
import type { SubscriptionInfo } from "@/lib/billing-data";
import type { BillingState, BillingView } from "@/lib/billing-status";

// One location on the Subscription page: plan, a big state label, what it means and the buttons
// that fit the state. Pure props, so the same card renders real data and the preview states.

export type BillingCardProps = {
  location: { id: string; name: string; address: string };
  view: BillingView;
  info: SubscriptionInfo | null;
  canManage: boolean;
  invoicePending: "month" | "year" | null;
  /** Formatted list prices for this location's currency. */
  prices: { month: string; year: string };
  savingPercent: number;
};

const PILL: Record<BillingState, string> = {
  trial: "bg-signal text-ink",
  active: "bg-ink text-signal",
  past_due: "bg-[#C8323C] text-white",
  canceling: "bg-[#E8E6E1] text-ink",
  expired: "border-2 border-ink text-ink",
  free: "border border-mist text-slate",
};

export async function BillingCard({ location, view, info, canManage, invoicePending, prices, savingPercent }: BillingCardProps) {
  const t = await getTranslations("BillingPage");
  const format = await getFormatter();
  const date = (iso: string | null) => (iso ? format.dateTime(new Date(iso), { dateStyle: "long" }) : "–");
  const money = (amount: number, currency: string) =>
    format.number(amount, { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: amount % 1 ? 2 : 0 });
  const nextAmount = info?.nextAmount != null ? money(info.nextAmount, info.currency) : info ? money(info.amount, info.currency) : "none";
  const { state } = view;

  return (
    <article className="overflow-hidden rounded-3xl bg-white">
      {state === "past_due" && (
        <div className="flex flex-col gap-3 bg-[#C8323C] p-4 text-white">
          <p className="font-black">{t("pastDueBand")}</p>
          {canManage && <PortalButton flow="card" locationId={location.id} label={t("updateCard")} look="secondary" />}
        </div>
      )}
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-black tracking-brand break-words">{location.name}</h2>
            <p className="text-sm text-slate break-words">{location.address}</p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-black ${PILL[state]}`}>{t(`states.${state}`)}</span>
        </div>

        <p className="font-black">
          {info
            ? t("plan", { price: money(info.amount, info.currency), interval: t(`intervals.${info.interval}`) })
            : t("planNone", { month: prices.month, year: prices.year })}
        </p>

        {state === "trial" && (
          <div className="flex flex-col gap-2">
            <p className="text-3xl font-black tracking-brand">{t("daysLeft", { days: view.daysLeft ?? 0 })}</p>
            {view.trialProgress !== null && (
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(view.trialProgress * 100)}
                className="h-2.5 overflow-hidden rounded-full bg-[#E8E6E1]"
              >
                <div className="h-full rounded-full bg-ink" style={{ width: `${Math.round(view.trialProgress * 100)}%` }} />
              </div>
            )}
            <p className="text-sm text-slate">{t("trialUntil", { date: date(view.accessUntil) })}</p>
            <p className="text-slate">
              {view.subscribed ? t("trialSubscribed", { date: date(view.nextChargeAt), amount: nextAmount }) : t("trialNoCard")}
            </p>
          </div>
        )}

        {state === "active" &&
          (view.subscribed ? (
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
              <dt className="text-sm text-slate">{t("nextCharge")}</dt>
              <dd className="font-black">{t("nextChargeValue", { date: date(view.nextChargeAt), amount: nextAmount })}</dd>
              <dt className="text-sm text-slate">{t("card")}</dt>
              <dd>
                {info?.card
                  ? t("cardValue", {
                      brand: info.card.brand.toUpperCase(),
                      last4: info.card.last4,
                      month: String(info.card.expMonth).padStart(2, "0"),
                      year: String(info.card.expYear).slice(-2),
                    })
                  : t("cardNone")}
              </dd>
            </dl>
          ) : (
            <p className="text-slate">
              {t(view.transfer ? "paidByTransfer" : "proUntil", { date: date(view.accessUntil) })}
            </p>
          ))}

        {state === "canceling" && <p className="text-lg font-black">{t("cancelUntil", { date: date(view.accessUntil) })}</p>}
        {state === "past_due" && (
          <p className="font-black">{view.accessUntil ? t("pastDueAccess", { date: date(view.accessUntil) }) : t("pastDueOff")}</p>
        )}
        {state === "expired" && <p className="text-slate">{t("expiredBody")}</p>}
        {state === "free" && <p className="text-slate">{t("freeBody")}</p>}

        {canManage ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-[#E8E6E1] pt-4">
            {!view.subscribed && (
              <div className="flex w-full flex-col gap-2">
                <p className="text-sm font-black">{t("start")}</p>
                <SubscribePro locationId={location.id} prices={prices} invoicePending={invoicePending} align="start" />
              </div>
            )}
            {view.subscribed && state === "active" && info?.interval === "month" && (
              <PortalButton flow="yearly" locationId={location.id} label={t("toYearly", { percent: savingPercent })} look="primary" />
            )}
            {view.subscribed && (state === "active" || state === "trial") && (
              <>
                <PortalButton flow="card" locationId={location.id} label={t("changeCard")} />
                <PortalButton flow="cancel" locationId={location.id} label={t("cancel")} look="quiet" />
              </>
            )}
            {state === "canceling" && <ReactivateButton locationId={location.id} />}
            {state === "past_due" && <PortalButton flow="cancel" locationId={location.id} label={t("cancel")} look="quiet" />}
          </div>
        ) : (
          <p className="border-t border-[#E8E6E1] pt-4 text-sm text-slate">{t("managersOnly")}</p>
        )}
      </div>
    </article>
  );
}
