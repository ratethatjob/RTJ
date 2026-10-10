import { getTranslations, setRequestLocale } from "next-intl/server";
import { LocationSelect } from "@/components/business/location-select";
import { Link } from "@/i18n/navigation";
import { getBusiness, pickLocation } from "@/lib/business";

export const instant = false;

export default async function JobsPage({ params, searchParams }: PageProps<"/[locale]/business/jobs">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const { supabase, org } = await getBusiness(locale, "/business/jobs");
  if (!org || org.locations.length === 0) return null;
  const t = await getTranslations("BusinessJobs");
  const location = pickLocation(org.locations, query.location);
  const ids = location ? [location.id] : org.locations.map((l) => l.id);

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, location_id, published_at, created_at")
    .in("location_id", ids)
    .order("created_at", { ascending: false });
  const { data: counts } = jobs?.length
    ? await supabase.rpc("job_application_counts", { p_job_ids: jobs.map((j) => j.id) })
    : { data: [] };
  const count = new Map(
    ((counts ?? []) as { job_id: string; total: number; new_count: number }[]).map((c) => [c.job_id, c]),
  );
  const place = new Map(org.locations.map((l) => [l.id, l]));

  return (
    <main className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-brand lg:text-5xl">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-slate">{t("body")}</p>
        </div>
        <Link
          href={{ pathname: "/business/jobs/new", query: location ? { location: location.id } : {} }}
          className="rounded-2xl bg-ink px-6 py-3 font-black text-paper"
        >
          {t("newJob")}
        </Link>
      </div>
      {org.locations.length > 1 && <LocationSelect locations={org.locations} selected={location?.id ?? null} />}

      {!jobs?.length ? (
        <p className="rounded-3xl bg-white p-6 text-slate">{t("noJobs")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {jobs.map((j) => {
            const c = count.get(j.id);
            const l = place.get(j.location_id);
            return (
              <li key={j.id}>
                <Link
                  href={`/business/jobs/${j.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-5"
                >
                  <span className="min-w-0">
                    <span className="block text-xl font-black">{j.title}</span>
                    <span className="text-slate">
                      {l?.address} · {t("applicants", { count: c?.total ?? 0 })}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {(c?.new_count ?? 0) > 0 && (
                      <span className="rounded-lg bg-signal px-2.5 py-1 text-sm font-black">
                        {t("newCount", { count: c!.new_count })}
                      </span>
                    )}
                    <span
                      className={`rounded-lg px-2.5 py-1 text-sm font-black ${
                        j.status === "open" ? "bg-ink text-paper" : "border border-mist"
                      }`}
                    >
                      {t(`status.${j.status}`)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
