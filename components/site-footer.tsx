import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { OPERATOR } from "@/lib/site-config";
import { LocaleSwitch } from "./locale-switch";
import { Logo } from "./logo";

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const tn = await getTranslations("Nav");
  const tm = await getTranslations("Metadata");

  const columns = [
    {
      title: t("workers"),
      links: [
        { href: "/search", label: tn("findWorkplaces") },
        { href: "/jobs", label: tn("jobs") },
        { href: "/app/rate", label: tn("rateAJob") },
        { href: "/app/account", label: t("account") },
      ],
    },
    {
      title: t("employers"),
      links: [
        { href: "/employers", label: tn("forEmployers") },
        { href: "/business/claim", label: t("claim") },
        { href: "/pricing", label: tn("pricing") },
        { href: "/ratethatjob-index", label: t("index") },
        { href: "/career-page", label: t("careerPage") },
      ],
    },
    {
      title: t("company"),
      links: [
        { href: "/about", label: tn("about") },
        { href: "/imprint", label: t("imprint") },
        { href: "/terms", label: t("terms") },
        { href: "/privacy", label: t("privacy") },
        { href: "/cookies", label: t("cookies") },
      ],
    },
  ];

  return (
    <footer className="mt-16 bg-ink text-paper">
      <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-12 sm:px-6 lg:py-16">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="max-w-xs">
            <Logo dark />
            <p className="mt-3 text-sm font-black uppercase tracking-tagline text-mist">{tm("tagline")}</p>
            <p className="mt-4 text-mist">{t("about")}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:gap-x-12">
            {columns.map((c) => (
              <div key={c.title}>
                <h2 className="font-black text-mist">{c.title}</h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {c.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="font-black hover:underline hover:underline-offset-4">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-mist sm:flex-row sm:items-center sm:justify-between">
          <p>
            © RateThatJob · {OPERATOR.name} · {t("noAds")}
          </p>
          <div className="flex items-center gap-4">
            <LocaleSwitch dark />
          </div>
        </div>
      </div>
    </footer>
  );
}
