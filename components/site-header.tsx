import { getLocale, getTranslations } from "next-intl/server";
import { getPathname, Link } from "@/i18n/navigation";
import { AccountLink } from "./account-link";
import { SearchIcon } from "./icons";
import { LocaleSwitch } from "./locale-switch";
import { Logo } from "./logo";

export async function SiteHeader({ withSearch = false }: { withSearch?: boolean }) {
  const t = await getTranslations("Nav");
  const searchPath = getPathname({ href: "/search", locale: await getLocale() });

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-4 sm:px-6 lg:py-6">
      <Link href="/" className="shrink-0">
        <Logo compact={withSearch} />
      </Link>

      {withSearch && (
        <form
          action={searchPath}
          role="search"
          className="mx-auto hidden w-full max-w-md items-center gap-2 rounded-xl bg-white px-4 lg:flex"
        >
          <SearchIcon className="size-4 text-slate" />
          <input
            name="q"
            aria-label={t("searchWorkplaces")}
            placeholder={t("searchWorkplaces")}
            className="w-full bg-transparent py-2.5 outline-none placeholder:text-ink"
          />
        </form>
      )}

      <nav className="ml-auto flex items-center gap-2 font-black sm:gap-5">
        {!withSearch && (
          <>
            <Link href="/search" className="hidden lg:inline">
              {t("findWorkplaces")}
            </Link>
            <Link href="/jobs" className="hidden lg:inline">
              {t("jobs")}
            </Link>
            <Link href="/employers" className="hidden lg:inline">
              {t("forEmployers")}
            </Link>
          </>
        )}
        <span className={withSearch ? "" : "hidden sm:inline"}>
          <LocaleSwitch />
        </span>
        <AccountLink signInLabel={t("signIn")} />
        {!withSearch && (
          <Link
            href="/app/rate"
            className="hidden rounded-xl bg-ink px-5 py-3 text-paper lg:inline"
          >
            {t("rateAJob")}
          </Link>
        )}
      </nav>
    </header>
  );
}
