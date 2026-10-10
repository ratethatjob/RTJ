import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Logo } from "@/components/logo";
import { Link } from "@/i18n/navigation";
import { getLocationById } from "@/lib/data";
import { publicClient } from "@/lib/data/supabase";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";

export const instant = false;
export const metadata: Metadata = { robots: { index: false, follow: false } };

async function locationForToken(token: string) {
  if (!supabaseUrl || !supabaseKey || !/^[\w-]{8,64}$/.test(token)) return null;
  const { data } = await publicClient().rpc("invite_location", { p_token: token });
  return data ? getLocationById(data as string) : null;
}

export default async function InvitePage({ params }: PageProps<"/[locale]/r/[token]">) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const location = await locationForToken(token);
  const t = await getTranslations("Invite");

  const points = [
    ["anonymousTitle", "anonymousBody", "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z"],
    ["minuteTitle", "minuteBody", "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"],
    ["liveTitle", "liveBody", "M5 12h14M13 6l6 6-6 6"],
  ] as const;

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-ink text-paper">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-6">
        <Link href="/" className="self-start">
          <Logo dark />
        </Link>
        {location ? (
          <>
            <p className="mt-12 text-sm font-black uppercase tracking-tagline text-mist">
              {t("eyebrow")}
            </p>
            <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-brand">
              {t("title", { company: location.companyName })}
            </h1>
            <p className="mt-4 text-lg text-mist">{t("body")}</p>
            <ul className="mt-8 flex flex-col gap-3">
              {points.map(([title, body, d]) => (
                <li key={title} className="flex gap-4 rounded-3xl bg-white/5 p-5">
                  <svg viewBox="0 0 24 24" className="mt-0.5 size-6 shrink-0 text-signal" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={d} />
                  </svg>
                  <span>
                    <span className="block text-lg font-black">{t(title)}</span>
                    <span className="text-mist">{t(body)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-10">
              <Link
                href={{ pathname: `/app/rate/${location.id}`, query: { invite: token } }}
                className="block rounded-2xl bg-signal py-4 text-center text-lg font-black text-ink"
              >
                {t("start")}
              </Link>
              <p className="mt-4 text-center text-sm text-mist">{t("footer")}</p>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-12 text-4xl font-black tracking-brand">{t("invalidTitle")}</h1>
            <p className="mt-4 text-lg text-mist">{t("invalidBody")}</p>
            <Link
              href="/app/rate"
              className="mt-auto block rounded-2xl bg-signal py-4 text-center text-lg font-black text-ink"
            >
              {(await getTranslations("Nav"))("rateAJob")}
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
