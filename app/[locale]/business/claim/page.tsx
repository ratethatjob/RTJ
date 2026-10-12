import { getTranslations, setRequestLocale } from "next-intl/server";
import { WorkplaceFinder } from "@/components/app/workplace-finder";
import { getPathname, redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { getMembership } from "@/lib/membership";
import { autoAreaName } from "@/lib/area-labels";
import { placesProvider } from "@/lib/places";

export const instant = false;

export default async function ClaimSearchPage({ params, searchParams }: PageProps<"/[locale]/business/claim">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q, add } = await searchParams;
  await requireUser(locale, add === "1" ? "/business/claim?add=1" : "/business/claim");
  // Members coming from "Request free access" (or signing in for it) go to their dashboard;
  // ?add=1 still opens the search to request another workplace.
  if (add !== "1" && (await getMembership())) redirect({ href: "/business", locale });
  const t = await getTranslations("Business");
  const [provider, autoArea] = await Promise.all([placesProvider(), autoAreaName(locale)]);

  return (
    <main className="w-full max-w-md pb-10 pt-4">
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
