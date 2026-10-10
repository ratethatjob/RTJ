import { getPathname, redirect } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BackLink } from "@/components/app/back-link";
import { SignInForm } from "@/components/app/sign-in-form";
import { getUser, safeNext } from "@/lib/auth";

export const instant = false;

export default async function SignInPage({ params, searchParams }: PageProps<"/[locale]/app/sign-in">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const home = getPathname({ href: "/", locale });
  // Employers sign in with a work email code only; workers also with Apple, Google or Facebook.
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
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-4">
      <BackLink href={next} />
      {business && <p className="mt-4 text-sm font-black uppercase tracking-tagline text-slate">{t("businessEyebrow")}</p>}
      <h1 className={`${business ? "mt-2" : "mt-4"} text-4xl font-black leading-[1.05] tracking-brand`}>
        {business ? t("businessTitle") : t("title")}
      </h1>
      <p className="mt-3 text-lg text-slate">{business ? t("businessSubtitle") : t("subtitle")}</p>
      <SignInForm next={next} welcome={welcome} linkError={query.error === "1"} business={business} />
    </main>
  );
}
