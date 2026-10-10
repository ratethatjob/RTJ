import { getTranslations, setRequestLocale } from "next-intl/server";
import { NewWorkplaceForm } from "@/components/app/new-workplace-form";
import { getPathname } from "@/i18n/navigation";

export const instant = false;

export default async function ClaimNewWorkplacePage({ params, searchParams }: PageProps<"/[locale]/business/claim/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q } = await searchParams;
  const t = await getTranslations("NewWorkplace");
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10">
      <h1 className="text-4xl font-black tracking-brand">{t("title")}</h1>
      <NewWorkplaceForm
        initialName={typeof q === "string" ? q.slice(0, 100) : ""}
        defaultCountry={locale === "hu" ? "HU" : "US"}
        rateBase={getPathname({ href: "/business/claim", locale })}
      />
    </main>
  );
}
