import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { pickMessages, SHARED_CLIENT_NAMESPACES } from "@/lib/client-messages";

// Internal tooling: never indexed, always needs a session.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children, params }: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await pickMessages([...SHARED_CLIENT_NAMESPACES, "Admin", "Categories"]);
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
