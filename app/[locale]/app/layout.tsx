import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { pickMessages, SHARED_CLIENT_NAMESPACES } from "@/lib/client-messages";

// Signed-in areas are never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children, params }: LayoutProps<"/[locale]/app">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await pickMessages([
    ...SHARED_CLIENT_NAMESPACES,
    "Auth",
    "Welcome",
    "ReviewForm",
    "NewWorkplace",
    "Categories",
    "Countries",
    "Account",
    "Apply",
    "Applications",
  ]);
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
