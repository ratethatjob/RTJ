import { getTranslations, setRequestLocale } from "next-intl/server";
import { WorkplaceFinder } from "@/components/app/workplace-finder";
import { getPathname } from "@/i18n/navigation";
import { autoAreaName } from "@/lib/area-labels";
import { placesProvider } from "@/lib/places";

export const instant = false;

export default async function ClaimSearchPage({ params, searchParams }: PageProps<"/[locale]/business/claim">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q } = await searchParams;
  const t = await getTranslations("Business");
  const [provider, autoArea] = await Promise.all([placesProvider(), autoAreaName(locale)]);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="text-4xl font-black tracking-brand">{t("claimTitle")}</h1>
      <p className="mt-2 text-slate">{t("claimSearchHint")}</p>
      <div className="mt-6">
        <WorkplaceFinder
          mode="claim"
          provider={provider}
          initialQuery={typeof q === "string" ? q.slice(0, 100) : ""}
          autoArea={autoArea}
          defaultCountry={locale === "hu" ? "HU" : "US"}
          manualBase={getPathname({ href: "/business/claim", locale })}
        />
      </div>
    </main>
  );
}
