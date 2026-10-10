import { getTranslations, setRequestLocale } from "next-intl/server";
import { LocationSelect } from "@/components/business/location-select";
import { ProfileForm } from "@/components/business/profile-form";
import { Link } from "@/i18n/navigation";
import { getBusiness, pickLocation } from "@/lib/business";
import { locationPath } from "@/lib/format";

export const instant = false;

export default async function ProfilePage({ params, searchParams }: PageProps<"/[locale]/business/profile">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const { supabase, org } = await getBusiness(locale, "/business/profile");
  if (!org || org.locations.length === 0) return null;
  const t = await getTranslations("Profile");
  const location = pickLocation(org.locations, query.location) ?? org.locations[0];
  const { data } = await supabase
    .from("location_profiles")
    .select("about, website, benefits, photos")
    .eq("location_id", location.id)
    .maybeSingle();

  return (
    <main className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-brand lg:text-5xl">{t("title")}</h1>
          <p className="mt-1 text-slate">{t("body")}</p>
        </div>
        <Link href={locationPath(location)} className="font-black underline underline-offset-4">
          {t("viewPublic")}
        </Link>
      </div>
      {org.locations.length > 1 && (
        <LocationSelect locations={org.locations} selected={location.id} allowAll={false} />
      )}
      <ProfileForm
        key={location.id}
        locationId={location.id}
        initial={{
          about: data?.about ?? "",
          website: data?.website ?? "",
          benefits: (data?.benefits ?? []).join("\n"),
          photos: data?.photos ?? [],
        }}
      />
    </main>
  );
}
