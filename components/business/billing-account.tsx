import { getFormatter, getTranslations } from "next-intl/server";
import { PortalButton } from "@/components/business/billing-actions";
import type { InvoiceRow } from "@/lib/billing-data";
import type { BillingDetails } from "@/lib/stripe";

/** Billing name, address, tax ID and the latest invoices (from Stripe), with "My invoices". */
export async function BillingAccount({
  details,
  invoices,
  canManage,
}: {
  details: BillingDetails | null;
  invoices: InvoiceRow[];
  canManage: boolean;
}) {
  const t = await getTranslations("BillingPage");
  const tp = await getTranslations("Plan");
  const format = await getFormatter();

  return (
    <section className="flex flex-col gap-5 rounded-3xl bg-white p-5">
      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-black tracking-brand">{tp("billingDetails")}</h2>
        {details ? (
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
            <dt className="text-sm text-slate">{tp("billingName")}</dt>
            <dd className="break-words">{details.name ?? "–"}</dd>
            <dt className="text-sm text-slate">{tp("billingAddress")}</dt>
            <dd className="break-words">{details.address.length ? details.address.join(", ") : "–"}</dd>
            <dt className="text-sm text-slate">{tp("billingTaxId")}</dt>
            <dd className="break-words">{details.taxIds.length ? details.taxIds.map((x) => x.value).join(", ") : "–"}</dd>
          </dl>
        ) : (
          <p className="text-sm text-slate">{tp("billingUnavailable")}</p>
        )}
        <p className="text-sm text-slate">{tp("billingEdit")}</p>
        {canManage && (
          <span>
            <PortalButton flow="home" label={t("myInvoices")} look="primary" />
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-[#E8E6E1] pt-4">
        <h3 className="font-black">{t("invoicesTitle")}</h3>
        {invoices.length === 0 ? (
          <p className="text-sm text-slate">{t("invoicesNone")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[#E8E6E1]">
            {invoices.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3">
                <span className="min-w-0">
                  <span className="block font-black">
                    {format.number(i.total, {
                      style: "currency",
                      currency: i.currency.toUpperCase(),
                      maximumFractionDigits: i.total % 1 ? 2 : 0,
                    })}
                  </span>
                  <span className="text-sm text-slate">
                    {format.dateTime(new Date(i.date), { dateStyle: "medium" })}
                    {i.number ? ` · ${i.number}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-3 text-sm">
                  <span
                    className={`rounded-lg px-2 py-0.5 font-black ${
                      i.status === "paid" ? "bg-[#E8E6E1]" : i.status === "open" ? "bg-[#C8323C] text-white" : "border border-mist"
                    }`}
                  >
                    {t.has(`invoiceStatus.${i.status}`) ? t(`invoiceStatus.${i.status}`) : i.status}
                  </span>
                  {i.pdf && (
                    <a href={i.pdf} target="_blank" rel="noopener noreferrer" className="font-black underline underline-offset-4">
                      {t("pdf")}
                    </a>
                  )}
                  {!i.pdf && i.url && (
                    <a href={i.url} target="_blank" rel="noopener noreferrer" className="font-black underline underline-offset-4">
                      {t("view")}
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
