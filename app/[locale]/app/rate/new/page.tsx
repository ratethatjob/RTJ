import { getTranslations, setRequestLocale } from "next-intl/server";
import { BackLink } from "@/components/app/back-link";
import { NewWorkplaceForm } from "@/components/app/new-workplace-form";
import { PlaceSearch } from "@/components/app/place-search";
import { getPathname } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { placesEnabled } from "@/lib/places";

export const instant = false;

export default async function NewWorkplacePage({ params, searchParams }: PageProps<"/[locale]/app/rate/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q } = await searchParams;
  await requireUser(locale, "/app/rate/new");
  const t = await getTranslations("NewWorkplace");
  const tp = await getTranslations("Places");
  const google = await placesEnabled();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-4">
      <BackLink href={getPathname({ href: "/app/rate", locale })} />
      <h1 className="mt-4 text-4xl font-black tracking-brand">{t("title")}</h1>
      <p className="mt-2 text-lg text-slate">{t("subtitle")}</p>
      {google && (
        <section className="mt-6 flex flex-col gap-3">
          <h2 className="text-xl font-black">{tp("title")}</h2>
          <PlaceSearch initialQuery={typeof q === "string" ? q.slice(0, 100) : ""} />
          <h2 className="mt-6 text-xl font-black">{tp("manualTitle")}</h2>
        </section>
      )}
      <NewWorkplaceForm
        initialName={typeof q === "string" ? q.slice(0, 100) : ""}
        defaultCountry={locale === "hu" ? "HU" : "US"}
        rateBase={getPathname({ href: "/app/rate", locale })}
      />
    </main>
  );
}
