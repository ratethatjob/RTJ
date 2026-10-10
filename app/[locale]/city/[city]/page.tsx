import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getSitemapLocations } from "@/lib/data";
import { localeAlternates } from "@/lib/seo";
import { CityHub, cityMetadata } from "./city-hub";

type Props = PageProps<"/[locale]/city/[city]">;

// Blocking so unknown cities get a real 404 status.
export const instant = false;

export async function generateStaticParams() {
  const cities = [...new Set((await getSitemapLocations()).map((l) => l.citySlug))];
  return cities.length ? cities.map((city) => ({ city })) : [{ city: "_" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, city } = await params;
  const meta = await cityMetadata(locale, city, null);
  if (!meta) return {};
  return {
    title: `${meta.title} | RateThatJob`,
    alternates: localeAlternates(`/city/${city}`, locale),
    ...(!meta.rated && { robots: { index: false } }),
  };
}

export default async function CityPage({ params }: Props) {
  const { locale, city } = await params;
  setRequestLocale(locale);
  return <CityHub city={city} category={null} />;
}
