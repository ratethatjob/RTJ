import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalPage, legalMetadata } from "@/components/legal-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  return legalMetadata("privacy", (await params).locale);
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage slug="privacy" locale={locale} />;
}
