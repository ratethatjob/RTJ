import { getLocale, getTranslations } from "next-intl/server";
import Form from "next/form";
import { getPathname, Link } from "@/i18n/navigation";
import { AccountMenu } from "./account-menu";
import { HeaderBusinessLink } from "./business-access";
import { HeaderNav } from "./header-nav";
import { LocaleSwitch } from "./locale-switch";
import { SearchIcon } from "./icons";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";

/** 64 px header: logo, the main sections (or a search field on workplace pages), then the
 *  business dashboard button for members, "Rate a job", the compact language switch and the
 *  account menu. Phones get the language switch in the menu. */
export async function SiteHeader({ withSearch = false }: { withSearch?: boolean }) {
  const t = await getTranslations("Nav");
  const searchPath = getPathname({ href: "/search", locale: await getLocale() });

  return (
    <header className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6 lg:gap-6">
      <Link href="/" className="shrink-0">
        <Logo compact={withSearch} />
      </Link>

      {withSearch ? (
        <Form
          action={searchPath}
          role="search"
          className="mx-auto hidden w-full max-w-md items-center gap-2 rounded-xl bg-white px-4 lg:flex"
        >
          <SearchIcon className="size-4 text-slate" />
          <input
            name="q"
            aria-label={t("searchWorkplaces")}
            placeholder={t("searchWorkplaces")}
            className="w-full bg-transparent py-2 text-[15px] outline-none placeholder:text-slate"
          />
        </Form>
      ) : (
        <HeaderNav
          items={[
            { href: "/search", label: t("findWorkplaces"), match: "^/(search|city)(/|$)" },
            { href: "/jobs", label: t("jobs"), match: "^/jobs(/|$)" },
          ]}
          employers={{
            href: "/employers",
            label: t("forEmployers"),
            match: "^/(employers|pricing|ratethatjob-index|careers-hub)(/|$)",
          }}
        />
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <HeaderBusinessLink />
        <Link
          href="/app/rate"
          className="hidden rounded-lg bg-ink px-4 py-2 text-[15px] font-semibold text-paper sm:inline-flex"
        >
          {t("rateAJob")}
        </Link>
        <div className="hidden sm:block">
          <LocaleSwitch compact />
        </div>
        <AccountMenu />
        <MobileMenu />
      </div>
    </header>
  );
}
