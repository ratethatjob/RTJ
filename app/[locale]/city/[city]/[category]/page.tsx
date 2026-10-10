import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getSitemapLocations } from "@/lib/data";
import { CATEGORY_SLUGS, categoryFromSlug } from "@/lib/format";
import { localeAlternates } from "@/lib/seo";
import { CityHub, cityMetadata } from "../city-hub";

type Props = PageProps<"/[locale]/city/[city]/[category]">;

export const instant = false;

export async function generateStaticParams() {
  const pairs = new Set(
    (await getSitemapLocations()).map((l) => `${l.citySlug}/${CATEGORY_SLUGS[l.category]}`),
  );
  const params = [...pairs].map((p) => {
    const [city, category] = p.split("/");
    return { city, category };
  });
  return params.length ? params : [{ city: "_", category: "_" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, city, category } = await params;
  const cat = categoryFromSlug(category);
  const meta = cat && (await cityMetadata(locale, city, cat));
  if (!meta) return {};
  return {
    title: `${meta.title} | RateThatJob`,
    alternates: localeAlternates(`/city/${city}/${category}`, locale),
    ...(!meta.rated && { robots: { index: false } }),
  };
}

export default async function CityCategoryPage({ params }: Props) {
  const { locale, city, category } = await params;
  setRequestLocale(locale);
  const cat = categoryFromSlug(category);
  if (!cat) notFound();
  return <CityHub city={city} category={cat} />;
}
