import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { Link } from "@/i18n/navigation";
import { JOB_TIERS, jobPricing, OPERATOR, PRICING, YEARLY_MONTHS } from "@/lib/site-config";
import { localeAlternates } from "@/lib/seo";

type Props = PageProps<"/[locale]/pricing">;

export const instant = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Pricing" });
  return { title: `${t("metaTitle")} | RateThatJob`, description: t("intro"), alternates: localeAlternates("/pricing", locale) };
}

const FREE = ["claim", "reply", "dispute", "inviteLink", "invites", "profile", "careersHub", "jobs", "profileBasic"] as const;
// Only what is actually behind Pro in the code: the Index on embeds, statistics, early warnings, early signals.
const PRO = ["warnings", "signals", "stats", "index"] as const;
const FAQ = ["q1", "trial", "q2", "q3", "q4"] as const;
const JOB_FEATURES = { standard: ["ad", "apply", "contact"], basic: ["summary", "cv"], pro: ["followups", "featured"] } as const;

export default async function PricingPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const yearly = (await searchParams).billing === "yearly";
  const t = await getTranslations("Pricing");
  const tj = await getTranslations("BusinessJobs");
  const jobPrice = jobPricing(locale === "hu" ? "HU" : "default");
  const format = await getFormatter();
  const price = PRICING[locale] ?? PRICING.en;
  // Hungarian workplaces pay in HUF, all others in EUR, whatever the page language: show both.
  const other = locale === "hu" ? PRICING.en : PRICING.hu;
  const otherJobs = jobPricing(locale === "hu" ? "default" : "HU");
  const money = (v: number, currency = price.currency) =>
    format.number(v, { style: "currency", currency, maximumFractionDigits: 0 });
  const proPrice =
    price.monthly == null
      ? null
      : yearly
        ? { value: money(price.monthly * YEARLY_MONTHS), per: t("perYear") }
        : { value: money(price.monthly), per: t("perMonth") };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 pb-8 pt-6 sm:px-6 lg:pt-8">
        <section className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-tagline text-slate">{t("eyebrow")}</p>
          <h1 className="mt-3 text-4xl font-black leading-[1.05] tracking-brand sm:text-5xl lg:text-7xl">{t("title")}</h1>
          <p className="mt-6 text-xl text-slate">{t("intro")}</p>
          <div className="mt-8 inline-grid grid-cols-2 rounded-2xl bg-white p-1.5 font-black">
            <Link
              href="/pricing"
              aria-current={!yearly ? "page" : undefined}
              className={`rounded-xl px-5 py-3 text-center ${!yearly ? "bg-ink text-paper" : ""}`}
            >
              {t("monthly")}
            </Link>
            <Link
              href={{ pathname: "/pricing", query: { billing: "yearly" } }}
              aria-current={yearly ? "page" : undefined}
              className={`rounded-xl px-5 py-3 text-center ${yearly ? "bg-ink text-paper" : ""}`}
            >
              {t("yearly")}
            </Link>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col rounded-[2rem] bg-white p-8">
            <h2 className="text-2xl font-black tracking-brand">{t("free.name")}</h2>
            <p className="mt-4 text-5xl font-black tracking-brand">{money(0)}</p>
            <p className="text-slate">{t("free.note")}</p>
            <ul className="mt-6 flex flex-col gap-3">
              {FREE.map((f) => (
                <li key={f} className="flex gap-3">
                  <span className="font-black" aria-hidden="true">✓</span>
                  {t(`free.features.${f}`)}
                </li>
              ))}
            </ul>
            <Link href="/business/claim" className="mt-8 rounded-2xl border-2 border-ink px-5 py-3 text-center text-base font-black">
              {t("free.cta")}
            </Link>
          </div>

          <div className="flex flex-col rounded-[2rem] bg-ink p-8 text-paper">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black tracking-brand">{t("pro.name")}</h2>
              {yearly && <span className="rounded-lg bg-signal px-2.5 py-1 text-sm font-black text-ink">{t("twoMonthsFree")}</span>}
            </div>
            {proPrice ? (
              <p className="mt-4 text-5xl font-black tracking-brand">
                {proPrice.value}
                <span className="text-lg font-medium text-mist"> / {proPrice.per}</span>
              </p>
            ) : (
              <p className="mt-4 text-3xl font-black tracking-brand">{t("onRequest")}</p>
            )}
            {other.monthly != null && (
              <p className="text-mist">
                {t("otherCurrency", {
                  price: `${money(yearly ? other.monthly * YEARLY_MONTHS : other.monthly, other.currency)} / ${yearly ? t("perYear") : t("perMonth")}`,
                })}
              </p>
            )}
            <p className="text-mist">{t("pro.note")}</p>
            <p className="mt-4 self-start rounded-lg bg-signal px-3 py-1.5 font-black text-ink">{t("pro.trial")}</p>
            <p className="mt-6 font-black">{t("pro.everythingFree")}</p>
            <ul className="mt-3 flex flex-col gap-3">
              {PRO.map((f) => (
                <li key={f} className="flex gap-3">
                  <span className="font-black text-signal" aria-hidden="true">✓</span>
                  {t(`pro.features.${f}`)}
                </li>
              ))}
            </ul>
            <Link href="/business/claim" className="mt-8 rounded-2xl bg-signal px-5 py-3 text-center text-base font-black text-ink">
              {t("pro.cta")}
            </Link>
          </div>

          <div className="flex flex-col rounded-[2rem] bg-white p-8">
            <h2 className="text-2xl font-black tracking-brand">{t("chains.name")}</h2>
            <p className="mt-4 text-3xl font-black tracking-brand">{t("chains.price")}</p>
            <p className="text-slate">{t("chains.note")}</p>
            <ul className="mt-6 flex flex-col gap-3">
              {(["allPro", "rollout", "manager"] as const).map((f) => (
                <li key={f} className="flex gap-3">
                  <span className="font-black" aria-hidden="true">✓</span>
                  {t(`chains.features.${f}`)}
                </li>
              ))}
            </ul>
            <a href={`mailto:${OPERATOR.email}?subject=RateThatJob`} className="mt-8 rounded-2xl border-2 border-ink px-5 py-3 text-center text-base font-black">
              {t("chains.cta")}
            </a>
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-black tracking-brand lg:text-4xl">{t("jobAds.title")}</h2>
            <p className="mt-3 text-lg text-slate">{t("jobAds.intro")}</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {JOB_TIERS.map((tier, i) => (
              <div
                key={tier}
                className={`flex flex-col rounded-[2rem] p-8 ${tier === "basic" ? "bg-ink text-paper" : "bg-white"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-2xl font-black tracking-brand">{tj(`packages.${tier}.name`)}</h3>
                  {tier === "basic" && (
                    <span className="rounded-lg bg-signal px-2.5 py-1 text-sm font-black text-ink">
                      {tj("applyMode.recommended")}
                    </span>
                  )}
                </div>
                <p className="mt-4 text-5xl font-black tracking-brand">
                  {format.number(jobPrice.prices[tier], {
                    style: "currency",
                    currency: jobPrice.currency,
                    maximumFractionDigits: 0,
                  })}
                </p>
                <p className={tier === "basic" ? "text-mist" : "text-slate"}>
                  {tj("packages.perAd")} ·{" "}
                  {t("otherCurrency", { price: money(otherJobs.prices[tier], otherJobs.currency) })}
                </p>
                <p className={`mt-3 ${tier === "basic" ? "text-mist" : "text-slate"}`}>{tj(`packages.${tier}.body`)}</p>
                <ul className="mt-6 flex flex-col gap-3">
                  {i > 0 && (
                    <li className="font-black">
                      {tj("packages.everythingIn", { name: tj(`packages.${JOB_TIERS[i - 1]}.name`) })}
                    </li>
                  )}
                  {JOB_FEATURES[tier].map((f) => (
                    <li key={f} className="flex gap-3">
                      <span className={`font-black ${tier === "basic" ? "text-signal" : ""}`} aria-hidden="true">
                        ✓
                      </span>
                      {tj(`packages.features.${f}`)}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/business/jobs/new"
                  className={`mt-8 rounded-2xl px-5 py-3 text-center text-base font-black ${
                    tier === "basic" ? "bg-signal text-ink" : "border-2 border-ink"
                  }`}
                >
                  {t("jobAds.cta")}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <p className="rounded-3xl bg-signal p-6 text-lg font-black">{t("promise")}</p>

        <section className="max-w-3xl">
          <h2 className="text-3xl font-black tracking-brand">{t("faqTitle")}</h2>
          <div className="mt-6 flex flex-col gap-3">
            {FAQ.map((q) => (
              <details key={q} className="group rounded-3xl bg-white p-6">
                <summary className="cursor-pointer list-none text-lg font-black">
                  {t(`faq.${q}`)}
                </summary>
                <p className="mt-3 text-slate">{t(`faq.${q}a`)}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
