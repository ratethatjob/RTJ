import { SITE_URL } from "@/lib/seo";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { EmbedGenerator } from "@/components/business/embed-generator";
import { JobsEmbedGenerator } from "@/components/business/jobs-embed-generator";
import { LocationSelect } from "@/components/business/location-select";
import { ProGate } from "@/components/business/trial-banner";
import { getPathname, Link } from "@/i18n/navigation";
import { getBusiness, pickLocation } from "@/lib/business";
import { locationPath } from "@/lib/format";
import { isTopRated, MIN_REVIEWS } from "@/lib/rtj-index";

export const instant = false;

export default async function IndexPage({
  params,
  searchParams,
}: PageProps<"/[locale]/business/index">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const { supabase, org } = await getBusiness(locale, "/business/index");
  if (!org || org.locations.length === 0) return null;
  const t = await getTranslations("Index");

  const location =
    pickLocation(org.locations, query.location) ?? org.locations[0];
  const tab = query.tab === "jobs" ? "jobs" : "index";
  // Snippets always point to the live site, whichever host the dashboard was opened on.
  const origin = SITE_URL;
  const few = (location.scores?.reviewCount ?? 0) < MIN_REVIEWS;
  const format = await getFormatter();
  const { data: openJobs } =
    tab === "jobs"
      ? await supabase
          .from("jobs")
          .select("id, title")
          .eq("location_id", location.id)
          .eq("status", "open")
          .or(`closes_at.is.null,closes_at.gte.${new Date().toISOString().slice(0, 10)}`)
          .order("published_at", { ascending: false })
      : { data: [] };
  const url = (path: string) =>
    `${origin}${getPathname({ href: path, locale })}`;
  const { data: sites } = await supabase
    .from("embed_referrers")
    .select("domain, views, last_seen")
    .eq("location_id", location.id)
    .order("views", { ascending: false })
    .limit(50);

  return (
    <main className="flex max-w-4xl flex-col gap-4">
      <div>
        <h1 className="text-4xl font-black tracking-brand lg:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-slate">
          {tab === "jobs" ? t("jobs.body") : t("body")}
        </p>
      </div>
      <nav className="flex gap-2">
        {(["index", "jobs"] as const).map((key) => (
          <Link
            key={key}
            href={{
              pathname: "/business/index",
              query: {
                ...(key === "jobs" && { tab: "jobs" }),
                location: location.id,
              },
            }}
            aria-current={key === tab ? "page" : undefined}
            className={`rounded-xl px-4 py-2.5 font-black ${key === tab ? "bg-ink text-paper" : "bg-white"}`}
          >
            {t(`tabs.${key}`)}
          </Link>
        ))}
      </nav>
      {org.locations.length > 1 && (
        <section className="rounded-3xl bg-white p-6">
          <LocationSelect
            locations={org.locations}
            selected={location.id}
            allowAll={false}
            extra={tab === "jobs" ? { tab: "jobs" } : {}}
          />
        </section>
      )}
      {tab === "jobs" ? (
        <JobsEmbedGenerator
          origin={origin}
          locale={locale}
          location={{
            id: location.id,
            name: location.name,
            profileUrl: url(locationPath(location)),
          }}
          company={{
            slug: location.companySlug,
            name: location.companyName,
            url: url(`/${location.companySlug}`),
          }}
          jobs={(openJobs ?? []).map((j) => ({
            id: j.id,
            title: j.title,
            url: url(`${locationPath(location)}/jobs/${j.id}`),
          }))}
        />
      ) : !location.pro ? (
        <ProGate feature="index" />
      ) : (
        <>
          {few && (
            <p className="rounded-3xl bg-signal p-5 font-black">
              {t("fewReviews")}
            </p>
          )}
          <EmbedGenerator
            origin={origin}
            locationId={location.id}
            locationName={location.name}
            // Under 5 reviews the badge asks for reviews, so its link opens the review form.
            linkUrl={url(few ? `/app/rate/${location.id}` : locationPath(location))}
            locale={locale}
            sealEarned={isTopRated(location)}
          />
        </>
      )}
      <section className="rounded-3xl bg-white p-6">
        <h2 className="text-xl font-black">
          {t("sitesTitle", { count: sites?.length ?? 0 })}
        </h2>
        {!sites?.length ? (
          <p className="mt-2 text-slate">{t("sitesEmpty")}</p>
        ) : (
          <ul className="mt-3 flex flex-col">
            {sites.map((s) => (
              <li
                key={s.domain}
                className="flex flex-wrap justify-between gap-2 border-t border-[#E8E6E1] py-3 first:border-t-0"
              >
                <span className="break-all font-black">{s.domain}</span>
                <span className="text-slate">
                  {t("views", { count: Number(s.views) })} ·{" "}
                  {t("lastSeen", {
                    date: format.dateTime(new Date(s.last_seen), {
                      dateStyle: "medium",
                    }),
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
