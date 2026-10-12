import { Suspense } from "react";
import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FooterGate } from "@/components/footer-gate";
import { HistoryTracker } from "@/components/history-tracker";
import { NavigationProgress } from "@/components/navigation-progress";
import { SiteFooter } from "@/components/site-footer";
import { routing } from "@/i18n/routing";
import { pickMessages, SHARED_CLIENT_NAMESPACES } from "@/lib/client-messages";
import { ogImage, pageMeta, SITE_URL } from "@/lib/seo";
import "../globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "900"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata" });
  // Defaults for pages without their own: share image, Open Graph and the large Twitter card.
  const { openGraph, twitter } = pageMeta({
    locale,
    path: "/",
    title: t("title"),
    description: t("description"),
    image: ogImage("home", locale),
  });
  return {
    metadataBase: new URL(SITE_URL),
    title: t("title"),
    description: t("description"),
    openGraph: { ...openGraph, url: undefined },
    twitter,
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${archivo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider messages={await pickMessages(SHARED_CLIENT_NAMESPACES)}>
          <HistoryTracker />
          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>
          {children}
          <FooterGate>
            <SiteFooter />
          </FooterGate>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
