import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Markdown, readLegal } from "@/lib/markdown";
import { ogImage, pageMeta } from "@/lib/seo";
import { SiteHeader } from "./site-header";

export type LegalSlug = "terms" | "privacy" | "cookies" | "imprint";

export async function legalMetadata(slug: LegalSlug, locale: string): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "Footer" });
  const tm = await getTranslations({ locale, namespace: "Metadata" });
  return pageMeta({
    locale,
    path: `/${slug}`,
    title: `${t(slug)} | RateThatJob`,
    description: tm("description"),
    image: ogImage("home", locale),
  });
}

export async function LegalPage({ slug, locale }: { slug: LegalSlug; locale: string }) {
  const source = await readLegal(slug, locale);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pb-8 pt-6 sm:px-6 lg:pt-10">
        <article className="rounded-[2rem] bg-white p-6 sm:p-10">
          <Markdown source={source} />
        </article>
      </main>
    </>
  );
}
