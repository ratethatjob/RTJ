import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getSitemapLocations } from "@/lib/data";
import { CATEGORY_SLUGS, categoryFromSlug } from "@/lib/format";
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
  return cat ? cityMetadata(locale, city, cat) : {};
}

export default async function CityCategoryPage({ params }: Props) {
  const { locale, city, category } = await params;
  setRequestLocale(locale);
  const cat = categoryFromSlug(category);
  if (!cat) notFound();
  return <CityHub city={city} category={cat} locale={locale} />;
}
