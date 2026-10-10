import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClaimForm } from "@/components/business/claim-form";
import { getLocationById } from "@/lib/data";

export const instant = false;

export default async function ClaimPage({ params }: PageProps<"/[locale]/business/claim/[locationId]">) {
  const { locale, locationId } = await params;
  setRequestLocale(locale);
  const location = await getLocationById(locationId);
  if (!location) notFound();
  const t = await getTranslations("Business");

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <h1 className="text-4xl font-black tracking-brand">{t("claimFormTitle", { name: location.name })}</h1>
      <p className="mt-1 font-black text-slate">
        {location.address}, {location.city}
      </p>
      <p className="mt-3 text-lg text-slate">{t("claimFormBody")}</p>
      <ClaimForm locationId={location.id} />
    </main>
  );
}
