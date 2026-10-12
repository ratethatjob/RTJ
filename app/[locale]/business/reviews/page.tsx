import { getTranslations, setRequestLocale } from "next-intl/server";
import { LocationSelect } from "@/components/business/location-select";
import { ReviewActions } from "@/components/business/review-actions";
import { ReviewCard } from "@/components/review-card";
import { Link } from "@/i18n/navigation";
import { getBusiness, pickLocation } from "@/lib/business";
import { toReview } from "@/lib/data/supabase";

export const instant = false;

const FILTERS = ["needs", "all", "verified", "invited"] as const;

export default async function BusinessReviewsPage({ params, searchParams }: PageProps<"/[locale]/business/reviews">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const { supabase, org } = await getBusiness(locale, "/business/reviews");
  if (!org) return null;
  const t = await getTranslations("Business");
  const tr = await getTranslations("Reviews");

  const filter = FILTERS.includes(query.filter as (typeof FILTERS)[number])
    ? (query.filter as (typeof FILTERS)[number])
    : "needs";
  const selected = pickLocation(org.locations, query.location);
  const ids = (selected ? [selected] : org.locations).map((l) => l.id);
  const address = new Map(org.locations.map((l) => [l.id, l.address]));

  let q = supabase.from("public_reviews").select("*", { count: "exact" }).in("location_id", ids);
  if (filter === "needs") q = q.is("reply_body", null);
  if (filter === "verified") q = q.neq("verification_level", "none");
  if (filter === "invited") q = q.eq("verification_level", "invited");
  const PER_PAGE = 50;
  const page = Math.max(1, Number(query.page) || 1);
  const { data, count } = ids.length
    ? await q.order("published_at", { ascending: false }).range((page - 1) * PER_PAGE, page * PER_PAGE - 1)
    : { data: [], count: 0 };
  const rows = data ?? [];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE));
  const needsCount = filter === "needs" ? (count ?? 0) : null;
  const pageHref = (p: number) => ({
    pathname: "/business/reviews" as const,
    query: { filter, page: String(p), ...(selected && { location: selected.id }) },
  });

  return (
    <main>
      <h1 className="text-4xl font-black tracking-brand lg:text-5xl">{t("reviewsTitle")}</h1>
      <p className="mt-1 text-slate">{t("reviewsBody")}</p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <nav className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={{ pathname: "/business/reviews", query: { filter: f, ...(selected && { location: selected.id }) } }}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${f === filter ? "bg-ink text-paper" : "border border-mist/60"}`}
            >
              {t(`filters.${f}`)}
              {f === "needs" && needsCount != null ? ` · ${needsCount}` : ""}
            </Link>
          ))}
        </nav>
        <LocationSelect locations={org.locations} selected={selected?.id ?? null} extra={{ filter }} />
      </div>

      <section className="mt-6 flex flex-col gap-4">
        {rows.length === 0 && <p className="rounded-3xl bg-white p-6 text-slate">{t("noReviews")}</p>}
        {rows.map((row) => {
          const review = toReview(row);
          return (
            <div key={review.id}>
              {org.locations.length > 1 && (
                <p className="mb-2 font-black text-slate">{address.get(row.location_id)}</p>
              )}
              <ReviewCard review={review} companyName={org.name}>
                <ReviewActions
                  reviewId={review.id}
                  locationId={row.location_id}
                  orgId={org.id}
                  existingReply={row.reply_body}
                  // Disputes are for owners and HR (can_dispute_review).
                  canDispute={review.verification === "none" && org.role !== "location_manager"}
                  startOpen={filter === "needs" && page === 1 && rows[0].id === review.id}
                />
              </ReviewCard>
            </div>
          );
        })}
      </section>
      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-between font-black">
          {page > 1 ? <Link href={pageHref(page - 1)}>{tr("previous")}</Link> : <span />}
          <span className="text-slate">{tr("pageOf", { page, pages })}</span>
          {page < pages ? <Link href={pageHref(page + 1)}>{tr("next")}</Link> : <span />}
        </nav>
      )}
    </main>
  );
}
