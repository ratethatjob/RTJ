import { NextIntlClientProvider } from "next-intl";
import { pickMessages, SHARED_CLIENT_NAMESPACES } from "@/lib/client-messages";

// Map results on the search page are a client component.
export default async function SearchLayout({ children }: LayoutProps<"/[locale]/search">) {
  const messages = await pickMessages([...SHARED_CLIENT_NAMESPACES, "Search", "Places"]);
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
