import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { publicClient } from "@/lib/data/supabase";
import { SiteHeader } from "@/components/site-header";

export const instant = false;
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function UnsubscribePage({ params, searchParams }: PageProps<"/[locale]/r/[token]/unsubscribe">) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const state = (await searchParams).done;
  const done = state === "1";
  const failed = state === "0";
  const t = await getTranslations("Unsubscribe");

  async function unsubscribe() {
    "use server";
    const { data, error } = /^[\w-]{8,64}$/.test(token)
      ? await publicClient().rpc("invite_unsubscribe", { p_token: token })
      : { data: false, error: null };
    // Only an email invite can be unsubscribed (not a shareable link or an unknown token).
    redirect({ href: { pathname: `/r/${token}/unsubscribe`, query: { done: !error && data ? "1" : "0" } }, locale });
  }

  return (
    <>
    <SiteHeader />
    <div className="flex flex-1 flex-col bg-ink text-paper">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-6">
        <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-brand">{t(done ? "doneTitle" : failed ? "failedTitle" : "title")}</h1>
        <p className="mt-4 text-lg text-mist">{t(done ? "doneBody" : failed ? "failedBody" : "body")}</p>
        {!done && !failed && (
          <form action={unsubscribe} className="mt-8">
            <button type="submit" className="w-full rounded-2xl bg-signal py-3 text-base font-black text-ink">
              {t("confirm")}
            </button>
          </form>
        )}
      </main>
    </div>
    </>
  );
}
