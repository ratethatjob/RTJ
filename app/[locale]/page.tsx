import Image from "next/image";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Home");

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 px-4 py-12">
      <h1>
        <Image
          src="/brand/logo-on-light.webp"
          alt="RateThatJob.com"
          width={2000}
          height={278}
          priority
          className="h-auto w-full max-w-sm"
        />
      </h1>
      <p className="text-3xl font-black tracking-brand">{t("headline")}</p>
      <form action="/search" className="flex flex-col gap-3">
        <input
          name="q"
          placeholder={t("searchPlaceholder")}
          className="rounded-xl border border-mist bg-white px-4 py-3 outline-none focus:border-ink"
        />
        <input
          name="where"
          placeholder={t("wherePlaceholder")}
          className="rounded-xl border border-mist bg-white px-4 py-3 outline-none focus:border-ink"
        />
        <button
          type="submit"
          className="rounded-xl bg-ink px-4 py-3 font-black text-paper"
        >
          {t("search")}
        </button>
      </form>
      <p className="text-sm uppercase tracking-tagline text-slate">
        {t("tagline")}
      </p>
    </main>
  );
}
