import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmbedGenerator } from "@/components/business/embed-generator";
import { LocationSelect } from "@/components/business/location-select";
import { getPathname } from "@/i18n/navigation";
import { getBusiness, pickLocation } from "@/lib/business";
import { locationPath } from "@/lib/format";
import { isTopRated, MIN_REVIEWS } from "@/lib/rtj-index";

export const instant = false;

export default async function IndexPage({ params, searchParams }: PageProps<"/[locale]/business/index">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const { org } = await getBusiness(locale, "/business/index");
  if (!org || org.locations.length === 0) return null;
  const t = await getTranslations("Index");

  const location = pickLocation(org.locations, query.location) ?? org.locations[0];
  const host = (await headers()).get("host");
  const origin = `${host?.startsWith("localhost") ? "http" : "https"}://${host}`;
  const few = (location.scores?.reviewCount ?? 0) < MIN_REVIEWS;

  return (
    <main className="flex max-w-4xl flex-col gap-4">
      <div>
        <h1 className="text-4xl font-black tracking-brand lg:text-5xl">{t("title")}</h1>
        <p className="mt-1 text-slate">{t("body")}</p>
      </div>
      {org.locations.length > 1 && (
        <section className="rounded-3xl bg-white p-6">
          <LocationSelect locations={org.locations} selected={location.id} allowAll={false} />
        </section>
      )}
      {few && <p className="rounded-3xl bg-signal p-5 font-black">{t("fewReviews")}</p>}
      <EmbedGenerator
        origin={origin}
        locationId={location.id}
        locationName={location.name}
        profileUrl={`${origin}${getPathname({ href: locationPath(location), locale })}`}
        locale={locale}
        sealEarned={isTopRated(location)}
      />
    </main>
  );
}
