import { getTranslations, setRequestLocale } from "next-intl/server";
import { WorkplaceFinder } from "@/components/app/workplace-finder";
import { getPathname } from "@/i18n/navigation";
import { autoAreaName } from "@/lib/area-labels";
import { requireUser } from "@/lib/auth";
import { placesProvider } from "@/lib/places";

export const instant = false;

export default async function ClaimNewWorkplacePage({ params, searchParams }: PageProps<"/[locale]/business/claim/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q } = await searchParams;
  await requireUser(locale, `/business/claim/new${typeof q === "string" && q ? `?q=${encodeURIComponent(q)}` : ""}`);
  const t = await getTranslations("NewWorkplace");
  const tb = await getTranslations("Business");
  const [provider, autoArea] = await Promise.all([placesProvider(), autoAreaName(locale)]);
  return (
    <main className="flex w-full max-w-md flex-1 flex-col pb-10 pt-4">
      <h1 className="text-4xl font-black tracking-brand">{t("title")}</h1>
      <p className="mt-2 text-slate">{tb("claimSearchHint")}</p>
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
