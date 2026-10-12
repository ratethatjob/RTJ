import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { BusinessBack } from "@/components/business/business-back";
import { BusinessSidebar } from "@/components/business/sidebar";
import { getUser } from "@/lib/auth";
import { getBusiness } from "@/lib/business";
import { pickMessages, SHARED_CLIENT_NAMESPACES } from "@/lib/client-messages";

// The employer dashboard is never indexed and always needs a session.
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const instant = false;

export default async function BusinessLayout({ children, params }: LayoutProps<"/[locale]/business">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await pickMessages([...SHARED_CLIENT_NAMESPACES, "Business", "Index", "Team", "BusinessJobs", "Profile", "Thread", "Plan", "NewWorkplace", "Categories", "Countries", "Places", "BillingPage"]);
  // Signed out: every page sends to sign-in with its own path (invite links, email links).
  if (!(await getUser()).user) {
    return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
  }
  const { supabase, org } = await getBusiness(locale, "/business");

  if (!org) {
    return (
      <NextIntlClientProvider messages={messages}>
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-4">
          <BusinessBack hasOrg={false} />
          {children}
        </div>
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
        <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <BusinessBack hasOrg />
          <div className="mt-2">{children}</div>
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
