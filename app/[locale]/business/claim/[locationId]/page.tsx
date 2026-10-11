import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClaimForm } from "@/components/business/claim-form";
import { requireUser } from "@/lib/auth";
import { getLocationById } from "@/lib/data";

export const instant = false;

export default async function ClaimPage({ params }: PageProps<"/[locale]/business/claim/[locationId]">) {
  const { locale, locationId } = await params;
  setRequestLocale(locale);
  const { user } = await requireUser(locale, `/business/claim/${locationId}`);
  const location = await getLocationById(locationId);
  if (!location) notFound();
  const t = await getTranslations("Business");

  return (
    <main className="w-full max-w-xl pb-10 pt-4">
      <h1 className="text-4xl font-black tracking-brand">{t("claimFormTitle", { name: location.name })}</h1>
      <p className="mt-1 font-black text-slate">
        {location.address}, {location.city}
      </p>
      <p className="mt-3 text-lg text-slate">{t("claimFormBody")}</p>
      <ClaimForm locationId={location.id} userId={user.id} accountEmail={user.email ?? ""} />
    </main>
  );
}
