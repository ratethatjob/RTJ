import { NextIntlClientProvider } from "next-intl";
import { pickMessages, SHARED_CLIENT_NAMESPACES } from "@/lib/client-messages";

// The Subscription page components outside /business (preview only).
export default async function BillingPreviewLayout({ children }: LayoutProps<"/[locale]/app/dev/billing-preview">) {
  const messages = await pickMessages([...SHARED_CLIENT_NAMESPACES, "Plan", "BillingPage"]);
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
