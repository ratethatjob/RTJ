import { getTranslations } from "next-intl/server";
import { JobCard } from "@/components/jobs/job-card";
import { LocationList } from "@/components/location-list";
import { Link } from "@/i18n/navigation";
import { areaPickerLabels } from "@/lib/area-labels";
import { getNearby } from "@/lib/data/nearby";
import { visitorArea } from "@/lib/visitor-area";
import { AreaPicker } from "./area-picker";

const COUNTRIES_IN = ["HU", "AE", "AT", "GB", "US"];

/** "Near you" on the home page: streamed per visitor (cookies, IP location), while the rest of
 *  the page stays static and cached. City first, then the country, then everything. */
export async function NearYou({ locale }: { locale: string }) {
  const area = await visitorArea(locale);
  const near =
    area.kind === "any" ? await getNearby([], null) : await getNearby(area.citySlugs, area.country);
  if (!near.locations.length && !near.jobs.length) return null;
  const t = await getTranslations("Home.near");
  const regions = new Intl.DisplayNames([locale], { type: "region" });

  const cityIn =
    area.kind === "area" ? t(`in.${area.id}`) : area.kind === "city" ? t("inCity", { city: area.city }) : null;
  const country = area.kind !== "any" ? area.country : null;
  const countryIn = country
    ? COUNTRIES_IN.includes(country)
      ? t(`inCountry.${country}`)
      : t("inCountryOther", { country: regions.of(country) ?? country })
    : null;
  const place = near.scope === "city" ? cityIn : near.scope === "country" ? countryIn : null;
  // Said when the city (or country) had nothing yet and we show a wider list.
  const widened = near.scope !== "city" && cityIn ? t("widened", { place: cityIn }) : null;
  const more =
    near.scope === "city" && area.kind !== "any"
      ? { href: `/city/${area.citySlugs[0]}`, label: t("seeCity") }
      : { href: "/search", label: t("seeAll") };

  return (
    <section aria-labelledby="near-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="near-title" className="text-3xl font-black tracking-brand lg:text-4xl">
            {place ? t("title", { place }) : t("popular")}
          </h2>
          {widened && <p className="mt-1 text-slate">{widened}</p>}
        </div>
        <AreaPicker labels={await areaPickerLabels()} />
      </div>
      {near.locations.length > 0 && (
        <div className="mt-6">
          <LocationList locations={near.locations} />
        </div>
      )}
      {near.jobs.length > 0 && (
        <>
          <h3 className="mt-8 text-xl font-black">{t("jobs")}</h3>
          <ul className="mt-3 grid gap-3 lg:grid-cols-3">
            {near.jobs.map((j) => (
              <li key={j.id}>
                <JobCard job={j} />
              </li>
            ))}
          </ul>
        </>
      )}
      <Link href={more.href} className="mt-6 inline-block font-black underline underline-offset-4">
        {more.label}
      </Link>
    </section>
  );
}

/** Same height as a typical section while it streams in, so the page doesn't jump. */
export function NearYouFallback() {
  return <div aria-hidden="true" className="min-h-[24rem] rounded-3xl bg-white/50" />;
}
