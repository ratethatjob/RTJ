import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalPage, legalMetadata } from "@/components/legal-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/cookies">): Promise<Metadata> {
  return legalMetadata("cookies", (await params).locale);
}

export default async function CookiesPage({ params }: PageProps<"/[locale]/cookies">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage slug="cookies" locale={locale} />;
}
