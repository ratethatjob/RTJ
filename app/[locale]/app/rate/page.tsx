import { getTranslations, setRequestLocale } from "next-intl/server";
import { BackLink } from "@/components/app/back-link";
import { WorkplaceFinder } from "@/components/app/workplace-finder";
import { getPathname } from "@/i18n/navigation";
import { autoAreaName } from "@/lib/area-labels";
import { placesProvider } from "@/lib/places";

export const instant = false;

export default async function RatePickerPage({ params, searchParams }: PageProps<"/[locale]/app/rate">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q } = await searchParams;
  const t = await getTranslations("RatePicker");
  const [provider, autoArea] = await Promise.all([placesProvider(), autoAreaName(locale)]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-4">
      <BackLink href={getPathname({ href: "/", locale })} />
      <h1 className="mt-4 text-4xl font-black tracking-brand">{t("title")}</h1>
      <p className="mt-2 text-slate">{t("hint")}</p>
      <div className="mt-6">
        <WorkplaceFinder
          mode="rate"
          provider={provider}
          initialQuery={typeof q === "string" ? q.slice(0, 100) : ""}
          autoArea={autoArea}
          defaultCountry={locale === "hu" ? "HU" : "US"}
          manualBase={getPathname({ href: "/app/rate", locale })}
        />
      </div>
    </main>
  );
}
