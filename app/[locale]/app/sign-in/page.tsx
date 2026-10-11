import { getPathname, redirect } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BackButton } from "@/components/app/back-button";
import { SignInForm } from "@/components/app/sign-in-form";
import { getUser, safeNext } from "@/lib/auth";
import { AUTH_PROVIDERS } from "@/lib/site-config";

export const instant = false;

export default async function SignInPage({ params, searchParams }: PageProps<"/[locale]/app/sign-in">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const home = getPathname({ href: "/", locale });
  // Employers sign in with a work email code only; workers also with the AUTH_PROVIDERS accounts, if any.
  const business = query.for === "business";
  const next = safeNext(query.next, business ? getPathname({ href: "/business", locale }) : home);
  // Employers skip the reviewer display-name step.
  const welcome = business ? next : getPathname({ href: { pathname: "/app/welcome", query: { next } }, locale });

  const { user } = await getUser();
  if (user) {
    if (business) redirect({ href: next, locale });
    redirect({ href: { pathname: "/app/welcome", query: { next } }, locale });
  }

  const t = await getTranslations("Auth");
  const tn = await getTranslations("Nav");
  // Without an earlier page in this tab, go to `next` only when it's a public page:
  // a page that needs sign-in would send the visitor straight back here.
  const needsSignIn = /^\/(?:hu\/)?(?:app|business)(?:[/?]|$)/.test(next);
  const fallback = needsSignIn ? (business ? getPathname({ href: "/employers", locale }) : home) : next;
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-4">
      <BackButton fallback={fallback} label={tn("back")} />
      {business && <p className="mt-4 text-sm font-black uppercase tracking-tagline text-slate">{t("businessEyebrow")}</p>}
      <h1 className={`${business ? "mt-2" : "mt-4"} text-4xl font-black leading-[1.05] tracking-brand`}>
        {business ? t("businessTitle") : t(AUTH_PROVIDERS.length ? "title" : "titleEmail")}
      </h1>
      <p className="mt-3 text-lg text-slate">{business ? t("businessSubtitle") : t("subtitle")}</p>
      <SignInForm next={next} welcome={welcome} linkError={query.error === "1"} business={business} />
    </main>
  );
}
