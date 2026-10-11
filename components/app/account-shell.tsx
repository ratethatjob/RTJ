import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/app/back-link";
import { BriefcaseIcon } from "@/components/business-access";
import { SiteHeader } from "@/components/site-header";
import { Link } from "@/i18n/navigation";
import { getMembership } from "@/lib/membership";

const ITEMS = [
  { key: "account", href: "/app/account" },
  { key: "applications", href: "/app/applications" },
  { key: "notifications", href: "/app/notifications" },
] as const;

export type AccountSection = (typeof ITEMS)[number]["key"];

/**
 * "My account" pages: "← Back" to the parent page on every size; on desktop a wide container
 * with the account menu on the left and the content next to it. Phones keep the single column.
 */
export async function AccountShell({
  active,
  back,
  children,
}: {
  active: AccountSection;
  /** Already localized path of the parent page. */
  back: string;
  children: React.ReactNode;
}) {
  const [t, membership] = await Promise.all([getTranslations("AccountNav"), getMembership()]);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-12 pt-2 lg:max-w-6xl lg:px-8">
        <BackLink href={back} />
        <div className="mt-2 lg:mt-4 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-12">
          <nav aria-label={t("label")} className="hidden lg:sticky lg:top-6 lg:flex lg:flex-col lg:gap-1">
            {ITEMS.map(({ key, href }) => (
              <Link
                key={key}
                href={href}
                aria-current={key === active ? "page" : undefined}
                className={`rounded-xl px-4 py-3 font-black ${key === active ? "bg-ink text-paper" : "hover:bg-white"}`}
              >
                {t(key)}
              </Link>
            ))}
            {membership && (
              <Link href="/business" className="mt-4 flex items-center gap-2 rounded-xl bg-signal px-4 py-3 font-black text-ink">
                <BriefcaseIcon />
                {t("business")}
              </Link>
            )}
          </nav>
          <div className="flex min-w-0 max-w-3xl flex-col gap-8">{children}</div>
        </div>
      </main>
    </>
  );
}
