import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalPage, legalMetadata } from "@/components/legal-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/imprint">): Promise<Metadata> {
  return legalMetadata("imprint", (await params).locale);
}

export default async function ImprintPage({ params }: PageProps<"/[locale]/imprint">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage slug="imprint" locale={locale} />;
}
