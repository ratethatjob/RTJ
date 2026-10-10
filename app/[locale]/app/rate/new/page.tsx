import { getTranslations, setRequestLocale } from "next-intl/server";
import { BackLink } from "@/components/app/back-link";
import { NewWorkplaceForm } from "@/components/app/new-workplace-form";
import { getPathname } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";

export const instant = false;

export default async function NewWorkplacePage({ params, searchParams }: PageProps<"/[locale]/app/rate/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q } = await searchParams;
  await requireUser(locale, "/app/rate/new");
  const t = await getTranslations("NewWorkplace");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-4">
      <BackLink href={getPathname({ href: "/app/rate", locale })} />
      <h1 className="mt-4 text-4xl font-black tracking-brand">{t("title")}</h1>
      <p className="mt-2 text-lg text-slate">{t("subtitle")}</p>
      <NewWorkplaceForm
        initialName={typeof q === "string" ? q.slice(0, 100) : ""}
        defaultCountry={locale === "hu" ? "HU" : "US"}
        rateBase={getPathname({ href: "/app/rate", locale })}
      />
    </main>
  );
}
