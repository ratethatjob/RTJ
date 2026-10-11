import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { BusinessSidebar } from "@/components/business/sidebar";
import { getBusiness } from "@/lib/business";
import { pickMessages, SHARED_CLIENT_NAMESPACES } from "@/lib/client-messages";

// The employer dashboard is never indexed and always needs a session.
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const instant = false;

export default async function BusinessLayout({ children, params }: LayoutProps<"/[locale]/business">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, org } = await getBusiness(locale, "/business");
  const messages = await pickMessages([...SHARED_CLIENT_NAMESPACES, "Business", "Index", "Team", "BusinessJobs", "Profile", "Thread", "Plan", "NewWorkplace", "Categories", "Countries", "Places"]);

  if (!org) {
    return (
      <NextIntlClientProvider messages={messages}>
        <div className="flex flex-1 flex-col">{children}</div>
      </NextIntlClientProvider>
    );
  }

  const ids = org.locations.map((l) => l.id);
  const { count } = ids.length
    ? await supabase
        .from("public_reviews")
        .select("id", { count: "exact", head: true })
        .in("location_id", ids)
        .is("reply_body", null)
    : { count: 0 };

  return (
    <NextIntlClientProvider messages={messages}>
      <div className="flex flex-1 flex-col lg:flex-row">
        <BusinessSidebar orgName={org.name} role={org.role} awaiting={count ?? 0} />
        <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </div>
    </NextIntlClientProvider>
  );
}
