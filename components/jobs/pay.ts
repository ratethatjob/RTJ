import type { Job } from "@/lib/data/types";

type T = (key: string, values?: Record<string, string>) => string;

/** "2 500–3 000 Ft / óra", "From $19 / hour" or null when no pay is listed. */
export function formatPay(job: Pick<Job, "payMin" | "payMax" | "payCurrency" | "payPeriod">, locale: string, t: T) {
  if (!job.payCurrency || !job.payPeriod || (job.payMin == null && job.payMax == null)) return null;
  const whole = [job.payMin, job.payMax].every((v) => v == null || Number.isInteger(v));
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: job.payCurrency,
    maximumFractionDigits: whole ? 0 : 2,
  });
  const period = t(`period.${job.payPeriod}`);
  if (job.payMin != null && job.payMax != null && job.payMin !== job.payMax) {
    return t("payRange", { min: money.format(job.payMin), max: money.format(job.payMax), period });
  }
  if (job.payMin != null) return t("payFrom", { min: money.format(job.payMin), period });
  return t("payUpTo", { max: money.format(job.payMax!), period });
}
