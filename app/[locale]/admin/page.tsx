import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import {
  BackfillPlaceTypes,
  BulkCategory,
  CategoryEditor,
  CsvImport,
  EntityForm,
  RefreshPages,
  SlugEditor,
  UnverifyEntity,
} from "@/components/admin/tools";
import { CATEGORIES, isCategory } from "@/lib/categories";
import { kindLabel } from "@/lib/place-types";
import { adminClient } from "@/lib/supabase/admin";
import { Decision } from "@/components/admin/decision";
import { AdminOverview, type Overview } from "@/components/admin/overview";
import { PurgeDemo } from "@/components/admin/purge-demo";
import { BackLink } from "@/components/app/back-link";
import { SiteHeader } from "@/components/site-header";
import { getPathname, Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { domainCheck } from "@/lib/claim-check";
import { countryCurrency, jobPricing, proPrice } from "@/lib/site-config";
import { dashboardUrl } from "@/lib/stripe";
import { StripeInvoiceCheck } from "@/components/admin/stripe-invoice-check";
import { ManualActions } from "@/components/admin/manual-tools";
import { NewPartnerKey, RevokePartnerKey } from "@/components/admin/partner-keys";
import { DuplicatePair, FillOsmAddresses, OsmImportRunner } from "@/components/admin/osm-tools";
import { OSM_CITIES, OSM_GROUPS } from "@/lib/osm-import-core";

export const instant = false;

const TABS = ["claims", "moderation", "verifications", "disputes", "reports", "orders", "plans"] as const;
const TOOLS = ["overview", "metrics", "workplaces", "manual", "duplicates", "osm", "entities", "import", "partners", "demo"] as const;
type Queue = (typeof TABS)[number];
type Tab = Queue | (typeof TOOLS)[number];

type Place = { name: string; address: string } | null;
type OrderRow = {
  id: string;
  created_at: string;
  status: "pending" | "paid";
  tier: "standard" | "basic" | "pro";
  previous_tier: "standard" | "basic" | "pro" | null;
  job_title: string;
  location: string;
  address: string;
  country: string;
  org_name: string;
  amount: number | null;
  currency: string | null;
  paid_via: "stripe" | "manual" | null;
  decided_at: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  stripe_customer_id: string | null;
};
type SubscriptionRow = {
  location_id: string;
  location: string;
  address: string;
  org_name: string;
  stripe_status: string;
  billing_interval: "month" | "year" | null;
  billing_currency: string | null;
  paid_until: string | null;
  stripe_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string;
  stripe_customer_id: string | null;
};
type PlanOrderRow = {
  id: string;
  created_at: string;
  billing_interval: "month" | "year";
  location: string;
  address: string;
  country: string;
  org_name: string;
  trial_ends_at: string | null;
  paid_until: string | null;
};
type ReviewRow = {
  id: string;
  position: string;
  relationship: string;
  overall: number | null;
  body: string | null;
  verification_level: string;
  locations: Place;
};

export default async function AdminPage({ params, searchParams }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { tab: rawTab, q: rawQ, cat: rawCat } = await searchParams;
  const cat = isCategory(rawCat) ? rawCat : null;
  const tab: Tab = [...TABS, ...TOOLS].includes(rawTab as Tab) ? (rawTab as Tab) : "overview";
  const q = typeof rawQ === "string" ? rawQ.trim().slice(0, 80) : "";
  const { supabase, user } = await requireUser(locale, "/admin");
  const t = await getTranslations("Admin");
  const tb = await getTranslations("Business");
  const tr = await getTranslations("Review");
  const tf = await getTranslations("ReviewForm");
  const trep = await getTranslations("Report.reasons");
  // Reports are stored as "<reason key>: details".
  const reportReason = (text: string) => {
    const [key, ...rest] = text.split(":");
    return trep.has(key) ? [trep(key), rest.join(":").trim()].filter(Boolean).join(": ") : text;
  };
  const format = await getFormatter();

  const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <p className="text-lg text-slate">{t("notAdmin")}</p>
      </main>
    );
  }

  const counts = await Promise.all([
    supabase.from("claim_requests").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending_moderation"),
    supabase.from("verifications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase
      .rpc("admin_job_order_list")
      .then((r) => ({ count: ((r.data ?? []) as OrderRow[]).filter((o) => o.status === "pending").length, data: r.data })),
    supabase.rpc("admin_plan_orders").then((r) => ({ count: ((r.data ?? []) as PlanOrderRow[]).length, data: r.data })),
  ]);

  const reviewCols = "id, position, relationship, overall, body, verification_level, locations(name, address)";
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });

  let items: { id: string; created_at: string; content: React.ReactNode; documentUrl?: string | null }[] = [];
  // Below the queue: recent card payments (orders) or Stripe subscriptions (plans).
  let extra: React.ReactNode = null;

  if (tab === "claims") {
    const { data } = await supabase
      .from("claim_requests")
      .select(
        "id, created_at, org_name, contact_name, job_title, account_email, phone, website, no_website, method, note, document_path, id_document_path, locations(name, address), claim_messages(id, from_admin, body, created_at)",
      )
      .eq("status", "open")
      .order("created_at");
    items = (data ?? []).map((c) => {
      const place = c.locations as unknown as Place;
      const check = domainCheck(c.account_email, c.website);
      const messages = ((c.claim_messages ?? []) as { id: string; from_admin: boolean; body: string; created_at: string }[])
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      return {
        id: c.id,
        created_at: c.created_at,
        content: (
          <>
            <p className="text-lg font-black">{c.org_name}</p>
            <p className="text-slate">{place?.name} · {place?.address}</p>
            <dl className="mt-3 grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
              <dt className="font-black">{tb("contactName")}</dt>
              <dd>{c.contact_name}{c.job_title ? `, ${c.job_title}` : ""}</dd>
              <dt className="font-black">{tb("method")}</dt>
              <dd>{tb(`methods.${c.method}`)}</dd>
              <dt className="font-black">{t("accountEmail")}</dt>
              <dd className="break-all">{c.account_email ?? "–"}</dd>
              <dt className="font-black">{tb("phone")}</dt>
              <dd>{c.phone ? <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="underline underline-offset-4">{c.phone}</a> : "–"}</dd>
              <dt className="font-black">{tb("website")}</dt>
              <dd className="break-all">
                {c.website ? (
                  <a href={c.website} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">
                    {c.website}
                  </a>
                ) : c.no_website ? (
                  tb("noWebsite")
                ) : (
                  "–"
                )}
              </dd>
              {check && (
                <>
                  <dt className="font-black">{t("domainCheck")}</dt>
                  <dd>
                    <span
                      className={`inline-block rounded-lg px-2.5 py-1 text-sm font-black ${
                        check.match ? "bg-signal text-ink" : "bg-[#C8323C] text-white"
                      }`}
                    >
                      {check.match
                        ? t("domainMatch", { domain: check.emailDomain })
                        : check.freemail
                          ? t("domainFreemail", { domain: check.emailDomain })
                          : check.siteHost
                            ? t("domainMismatch", { domain: check.emailDomain, site: check.siteHost })
                            : t("domainNoSite", { domain: check.emailDomain })}
                    </span>
                  </dd>
                </>
              )}
              <dt className="font-black">{c.method === "authorization" ? tb("documentAuthorization") : tb("documentRegistry")}</dt>
              <dd>
                {c.document_path ? (
                  <a href={docHref("claim", c.id, "company")} target="_blank" rel="noreferrer" className="font-black underline underline-offset-4">
                    {t("openDocument")}
                  </a>
                ) : (
                  "–"
                )}
              </dd>
              <dt className="font-black">{tb("idDocument")}</dt>
              <dd>
                {c.id_document_path ? (
                  <a href={docHref("claim", c.id, "id")} target="_blank" rel="noreferrer" className="font-black underline underline-offset-4">
                    {t("openDocument")}
                  </a>
                ) : (
                  t("idMissing")
                )}
              </dd>
              {c.note && (<><dt className="font-black">{tb("note")}</dt><dd className="whitespace-pre-line">{c.note}</dd></>)}
              {(c.document_path || c.id_document_path) && (
                <>
                  <dt className="font-black">{t("docs.deletes")}</dt>
                  <dd>{t("docs.afterDecision")}</dd>
                </>
              )}
            </dl>
            {messages.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {messages.map((m) => (
                  <li key={m.id} className={`rounded-2xl p-3 ${m.from_admin ? "bg-paper" : "border border-mist/60"}`}>
                    <p className="text-xs font-black uppercase tracking-tagline text-slate">
                      {m.from_admin ? t("infoAsked") : t("infoAnswer")} · {date(m.created_at)}
                    </p>
                    <p className="mt-1 whitespace-pre-line break-words">{m.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        ),
      };
    });
    extra = await DecidedDocuments({ kind: "claim", supabase });
  } else if (tab === "moderation") {
    const { data } = await supabase
      .from("reviews")
      .select(`${reviewCols}, created_at, hold_reason`)
      .eq("status", "pending_moderation")
      .order("created_at");
    const oneHold = (reason: string) =>
      reason.startsWith("ai:")
        ? `${t("holdReasons.ai")}: ${reason
            .slice(3)
            .split(",")
            .map((x) => (t.has(`aiReasons.${x}`) ? t(`aiReasons.${x}`) : x))
            .join(", ")}`
        : t.has(`holdReasons.${reason}`)
          ? t(`holdReasons.${reason}`)
          : reason;
    // A rule hold and an AI hold together: "burst + ai:spam".
    const holdLabel = (reason: string) => reason.split(" + ").map(oneHold).join(" · ");
    items = (data ?? []).map((r) => ({
      id: r.id,
      created_at: r.created_at,
      content: (
        <>
          {r.hold_reason && (
            <p className="mb-2 inline-block rounded-lg bg-ink px-2.5 py-1 text-sm font-black text-paper">
              {holdLabel(r.hold_reason)}
            </p>
          )}
          <ReviewSummary r={r as unknown as ReviewRow} relationship={tr(`relationship.${r.relationship}`)} />
        </>
      ),
    }));
  } else if (tab === "verifications") {
    const { data } = await supabase
      .from("verifications")
      .select(`id, created_at, doc_type, storage_path, reviews(${reviewCols})`)
      .eq("status", "pending")
      .order("created_at");
    items = (data ?? []).map((v) => {
      const r = v.reviews as unknown as ReviewRow;
      return {
        id: v.id,
        created_at: v.created_at,
        documentUrl: v.storage_path ? docHref("review", v.id, "proof") : null,
        content: (
          <>
            <p className="mb-2 inline-block rounded-lg border border-mist px-2.5 py-1 text-sm font-black">
              {tf(`docTypes.${v.doc_type}`)}
            </p>
            {r && <ReviewSummary r={r} relationship={tr(`relationship.${r.relationship}`)} />}
            <p className="mt-2 text-sm text-slate">
              {t("docs.deletes")}: {t("docs.afterDecision")}
            </p>
          </>
        ),
      };
    });
    extra = await DecidedDocuments({ kind: "review", supabase });
  } else if (tab === "disputes") {
    const { data } = await supabase
      .from("disputes")
      .select(`id, created_at, reason, reviews(${reviewCols})`)
      .eq("status", "open")
      .order("created_at");
    items = (data ?? []).map((d) => {
      const r = d.reviews as unknown as ReviewRow;
      return {
        id: d.id,
        created_at: d.created_at,
        content: (
          <>
            <p className="whitespace-pre-line rounded-2xl bg-paper p-4">{reportReason(d.reason)}</p>
            {r && (
              <div className="mt-3">
                <ReviewSummary r={r} relationship={tr(`relationship.${r.relationship}`)} />
              </div>
            )}
          </>
        ),
      };
    });
  } else if (tab === "orders") {
    const tj = await getTranslations("BusinessJobs");
    const rows = (counts[5].data ?? []) as OrderRow[];
    const orderLine = (o: OrderRow) => {
      const pricing = jobPricing(o.country);
      // Stored amount (smallest unit) once a payment started, else the list price.
      const amount =
        o.amount != null && o.currency
          ? format.number(o.amount / 100, { style: "currency", currency: o.currency.toUpperCase(), maximumFractionDigits: 0 })
          : format.number(pricing.prices[o.tier] - (o.previous_tier ? pricing.prices[o.previous_tier] : 0), {
              style: "currency",
              currency: pricing.currency,
              maximumFractionDigits: 0,
            });
      return (
        <>
          <p className="text-lg font-black">
            {tj(`packages.${o.tier}.name`)}
            {o.previous_tier && ` (${t("orderUpgrade", { from: tj(`packages.${o.previous_tier}.name`) })})`} · {amount}
          </p>
          <p>
            {o.job_title} · {o.location}, {o.address}
          </p>
          <p className="text-slate">{o.org_name}</p>
          <StripeLinks
            status={
              o.status === "paid"
                ? t(o.paid_via === "stripe" ? "stripe.paidCard" : "stripe.paidManual")
                : o.stripe_session_id
                  ? t("stripe.checkoutStarted")
                  : t("stripe.notStarted")
            }
            links={[
              o.stripe_payment_intent && { label: t("stripe.payment"), href: dashboardUrl("payments", o.stripe_payment_intent) },
              o.stripe_customer_id && { label: t("stripe.customer"), href: dashboardUrl("customers", o.stripe_customer_id) },
            ]}
          />
        </>
      );
    };
    items = rows
      .filter((o) => o.status === "pending")
      .map((o) => ({ id: o.id, created_at: o.created_at, content: orderLine(o) }));
    const paid = rows.filter((o) => o.status === "paid");
    extra = paid.length > 0 && (
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-black uppercase tracking-tagline text-slate">{t("stripe.paidRecently")}</h2>
        <ul className="flex flex-col gap-3">
          {paid.map((o) => (
            <li key={o.id} className="rounded-3xl bg-white p-5">
              <p className="mb-2 text-sm text-slate">{date(o.decided_at ?? o.created_at)}</p>
              {orderLine(o)}
            </li>
          ))}
        </ul>
      </section>
    );
  } else if (tab === "plans") {
    const tp = await getTranslations("Plan");
    const { data: subs } = await supabase.rpc("admin_stripe_subscriptions");
    const subscriptions = (subs ?? []) as SubscriptionRow[];
    extra = (
      <>
      <StripeInvoiceCheck />
      {subscriptions.length > 0 && (
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-black uppercase tracking-tagline text-slate">{t("stripe.subscriptions")}</h2>
        <ul className="flex flex-col gap-3">
          {subscriptions.map((x) => (
            <li key={x.stripe_subscription_id} className="rounded-3xl bg-white p-5">
              <p className="text-lg font-black">
                Pro{x.billing_interval && ` · ${tp(`intervals.${x.billing_interval}`)}`}
                {x.billing_currency && ` · ${x.billing_currency.toUpperCase()}`}
              </p>
              <p>
                {x.location}, {x.address}
              </p>
              <p className="text-slate">
                {x.org_name}
                {x.paid_until && ` · ${tp("paidUntil", { date: date(x.paid_until) })}`}
              </p>
              <StripeLinks
                status={`${t(`stripe.status.${x.stripe_status}`)}${
                  x.cancel_at_period_end && x.stripe_period_end ? ` · ${tp("cancelsOn", { date: date(x.stripe_period_end) })}` : ""
                }`}
                links={[
                  { label: t("stripe.subscription"), href: dashboardUrl("subscriptions", x.stripe_subscription_id) },
                  x.stripe_customer_id && { label: t("stripe.customer"), href: dashboardUrl("customers", x.stripe_customer_id) },
                ]}
              />
            </li>
          ))}
        </ul>
      </section>
      )}
      </>
    );
    items = ((counts[6].data ?? []) as PlanOrderRow[]).map((o) => {
      const price = { currency: countryCurrency(o.country) };
      const amount = proPrice(price.currency, o.billing_interval === "year" ? "year" : "month");
      return {
        id: o.id,
        created_at: o.created_at,
        content: (
          <>
            <p className="text-lg font-black">
              Pro · {tp(`intervals.${o.billing_interval}`)}
              {amount != null &&
                ` · ${format.number(amount, { style: "currency", currency: price.currency, maximumFractionDigits: 0 })}`}
            </p>
            <p>
              {o.location}, {o.address}
            </p>
            <p className="text-slate">
              {o.org_name}
              {o.paid_until && ` · ${tp("paidUntil", { date: date(o.paid_until) })}`}
              {!o.paid_until && o.trial_ends_at && ` · ${tp("trialUntil", { date: date(o.trial_ends_at) })}`}
            </p>
          </>
        ),
      };
    });
  } else if (tab === "reports") {
    const { data } = await supabase
      .from("reports")
      .select(`id, created_at, reason, reviews(${reviewCols})`)
      .eq("status", "open")
      .not("review_id", "is", null)
      .order("created_at");
    items = (data ?? []).map((d) => {
      const r = d.reviews as unknown as ReviewRow;
      return {
        id: d.id,
        created_at: d.created_at,
        content: (
          <>
            <p className="whitespace-pre-line rounded-2xl bg-paper p-4">{reportReason(d.reason)}</p>
            {r && (
              <div className="mt-3">
                <ReviewSummary r={r} relationship={tr(`relationship.${r.relationship}`)} />
              </div>
            )}
          </>
        ),
      };
    });
  }

  type CompanyRow = {
    id: string;
    name: string;
    slug: string;
    locations: {
      id: string;
      slug: string;
      address: string;
      city: string;
      country: string;
      category: string;
      location_entity_links: {
        id: string;
        source: string;
        verified_at: string | null;
        legal_entities: { name: string; registry_id: string | null } | null;
      }[];
    }[];
  };
  const companies: CompanyRow[] =
    (tab === "workplaces" || tab === "entities") && q
      ? (((
          await supabase
            .from("companies")
            .select(
              "id, name, slug, locations(id, slug, address, city, country, category, location_entity_links(id, source, verified_at, legal_entities(name, registry_id)))",
            )
            .ilike("name", `%${q.replace(/[%_\\,()]/g, " ")}%`)
            .order("name")
            .limit(20)
        ).data ?? []) as unknown as CompanyRow[])
      : [];

  // Categories to check: decided by the name or the AI, low confidence, or reported as wrong.
  const review =
    tab === "workplaces"
      ? await (async () => {
          const db = adminClient();
          if (!db) return null;
          const [{ data: places }, { data: reports }] = await Promise.all([
            db
              .from("locations")
              .select("id, name, address, city, category, category_source, category_confidence, place_type, place_type_en, place_type_hu")
              .or("category_source.in.(name,ai,generic),category_confidence.eq.low,category_source.is.null")
              .not("category_source", "in", "(admin,owner)")
              .order("created_at", { ascending: false })
              .limit(100),
            db
              .from("category_reports")
              .select("location_id, suggested_category, note, created_at, locations(id, name, address, city, category, category_source, category_confidence, place_type, place_type_en, place_type_hu)")
              .is("resolved_at", null)
              .order("created_at", { ascending: false })
              .limit(100),
          ]);
          type Row = NonNullable<typeof places>[number];
          const rows = new Map<string, Row & { reports: { category: string; note: string | null }[] }>();
          for (const r of reports ?? []) {
            const l = r.locations as unknown as Row | null;
            if (!l) continue;
            const row = rows.get(l.id) ?? { ...l, reports: [] };
            row.reports.push({ category: r.suggested_category as string, note: r.note });
            rows.set(l.id, row);
          }
          for (const l of places ?? []) if (!rows.has(l.id)) rows.set(l.id, { ...l, reports: [] });
          return [...rows.values()];
        })()
      : null;

  // Bulk fix: every workplace in one category (Workplaces tab, ?cat=).
  const tcat = await getTranslations("Categories");
  const byCategory =
    tab === "workplaces" && cat
      ? (
          (
            await supabase
              .from("locations")
              .select("id, name, address, city, category, place_type, place_type_en, place_type_hu")
              .eq("category", cat)
              .order("name")
              .limit(200)
          ).data ?? []
        ).map((l) => ({
          id: l.id as string,
          name: l.name as string,
          address: l.address as string,
          city: l.city as string,
          kind: kindLabel(
            { type: l.place_type, en: l.place_type_en, hu: l.place_type_hu },
            locale,
            tcat(l.category as string),
          ),
        }))
      : null;

  type Metrics = {
    months: { month: string; reviews: number; verified: number; users: number; applications: number }[];
    locations: number;
    claimed_locations: number;
    rated_locations: number;
    invites_used: number;
    invite_links: number;
    open_jobs: number;
    embeds: number;
  };
  const overview = tab === "overview" ? ((await supabase.rpc("admin_overview")).data as Overview | null) : null;
  const metrics = tab === "metrics" ? ((await supabase.rpc("admin_metrics")).data as Metrics | null) : null;
  // Map search calls per month (Google Places budget).
  const placesUsage =
    tab === "metrics"
      ? (((await supabase.rpc("admin_places_usage")).data ?? []) as { month: string; provider: string; kind: string; calls: number }[])
      : [];
  // New workplaces per day and source (search, review, claim, OSM import…).
  const newPlaces =
    tab === "metrics"
      ? (((await supabase.rpc("admin_new_locations", { p_days: 14 })).data ?? []) as { day: string; via: string; count: number }[])
      : [];
  const viaKeys = [...new Set(newPlaces.map((r) => r.via))].sort();
  const newDays = [...new Set(newPlaces.map((r) => r.day))];
  // OpenStreetMap import: per city, the run log, imported places without reviews (?city=).
  const osmCityFilter = typeof (await searchParams).city === "string" ? String((await searchParams).city).slice(0, 60) : "";
  const osm =
    tab === "osm"
      ? await Promise.all([
          supabase.rpc("admin_osm_summary"),
          supabase.rpc("admin_osm_runs", { p_limit: 40 }),
          supabase.rpc("admin_osm_unrated", { p_city: osmCityFilter || null, p_limit: 100 }),
          supabase.rpc("admin_osm_address_summary"),
        ]).then(([a, b, c, d]) => ({
          addresses: (d.data ?? []) as { city: string; pending: number; found: number; no_address: number }[],
          summary: (a.data ?? []) as { city: string; imported: number; unrated: number; gone: number; last_run: string | null }[],
          runs: (b.data ?? []) as {
            id: string;
            city: string;
            grp: string;
            started_at: string;
            fetched: number;
            created: number;
            matched: number;
            known: number;
            skipped: number;
            gone: number;
            error: string | null;
            triggered_by: string | null;
          }[],
          unrated: (c.data ?? []) as {
            id: string;
            company_slug: string;
            slug: string;
            name: string;
            address: string;
            city: string;
            category: string;
            place_type: string | null;
            osm_id: string;
          }[],
        }))
      : null;
  // New hand-entered workplaces (and the hidden ones), each with its closest possible duplicate.
  type ManualRow = {
    id: string;
    name: string;
    address: string;
    city: string;
    category: string;
    path: string;
    created_at: string;
    created_by_email: string | null;
    geocode_status: "ok" | "not_found" | null;
    has_position: boolean;
    hidden_at: string | null;
    reviews: number;
    dup_id: string | null;
    dup_name: string | null;
    dup_address: string | null;
    dup_path: string | null;
    dup_distance_m: number | null;
  };
  const manual =
    tab === "manual"
      ? await Promise.all([
          supabase.rpc("admin_manual_locations", { p_hidden: false, p_limit: 100 }),
          supabase.rpc("admin_manual_locations", { p_hidden: true, p_limit: 100 }),
        ]).then(([a, b]) => ({ fresh: (a.data ?? []) as ManualRow[], hidden: (b.data ?? []) as ManualRow[] }))
      : null;
  const partnerKeys =
    tab === "partners"
      ? (((await supabase.rpc("admin_partner_keys")).data ?? []) as {
          id: string;
          name: string;
          hourly_limit: number;
          created_at: string;
          revoked_at: string | null;
          last_used_at: string | null;
          uses: number;
          workplaces: number;
        }[])
      : null;
  const duplicates =
    tab === "duplicates"
      ? (((await supabase.rpc("admin_duplicate_pairs", { p_limit: 60 })).data ?? []) as {
          a: string;
          a_name: string;
          a_address: string;
          a_path: string;
          a_reviews: number;
          a_via: string | null;
          b: string;
          b_name: string;
          b_address: string;
          b_path: string;
          b_reviews: number;
          b_via: string | null;
          distance_m: number;
          similarity: number;
        }[])
      : null;
  const demo =
    tab === "demo"
      ? ((await supabase.rpc("admin_demo_summary")).data as Record<"companies" | "locations" | "reviews" | "jobs" | "users", number> | null)
      : null;
  const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "–");

  return (
    <>
    <SiteHeader />
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pb-12 pt-2 lg:max-w-4xl">
      <BackLink href={getPathname({ href: "/app/account", locale })} />
      <h1 className="text-4xl font-black tracking-brand lg:text-5xl">{t("title")}</h1>
      <nav className="-mx-4 flex flex-wrap gap-2 px-4">
        <Link
          href={{ pathname: "/admin", query: { tab: "overview" } }}
          aria-current={tab === "overview" ? "page" : undefined}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === "overview" ? "bg-ink text-paper" : "bg-white"}`}
        >
          {t("tabs.overview")}
        </Link>
        {TABS.map((key, i) => (
          <Link
            key={key}
            href={{ pathname: "/admin", query: { tab: key } }}
            aria-current={key === tab ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold ${
              key === tab ? "bg-ink text-paper" : "bg-white"
            }`}
          >
            {t(`tabs.${key}`)}
            <span className={`rounded-full px-1.5 text-xs ${key === tab ? "bg-signal text-ink" : "bg-paper"}`}>
              {counts[i].count ?? 0}
            </span>
          </Link>
        ))}
        {TOOLS.filter((key) => key !== "overview").map((key) => (
          <Link
            key={key}
            href={{ pathname: "/admin", query: { tab: key } }}
            aria-current={key === tab ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${key === tab ? "bg-ink text-paper" : "border border-mist/60"}`}
          >
            {t(`tabs.${key}`)}
          </Link>
        ))}
      </nav>
      {tab === "overview" ? (
        overview ? <AdminOverview data={overview} /> : <p className="rounded-3xl bg-white p-5 text-slate">{t("empty")}</p>
      ) : tab === "metrics" ? (
        metrics && (
          <section className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(
                [
                  [t("metrics.claimed"), pct(metrics.claimed_locations, metrics.locations), `${metrics.claimed_locations} / ${metrics.locations}`],
                  [t("metrics.rated"), String(metrics.rated_locations), t("metrics.ofLocations", { count: metrics.locations })],
                  [t("metrics.invites"), String(metrics.invites_used), t("metrics.inviteLinks", { count: metrics.invite_links })],
                  [t("metrics.openJobs"), String(metrics.open_jobs), ""],
                  [t("metrics.embeds"), String(metrics.embeds), ""],
                ] as const
              ).map(([label, value, sub]) => (
                <div key={label} className="rounded-3xl bg-white p-5">
                  <p className="text-sm font-black text-slate">{label}</p>
                  <p className="text-3xl font-black tracking-brand">{value}</p>
                  {sub && <p className="text-sm text-slate">{sub}</p>}
                </div>
              ))}
            </div>
            <div className="overflow-x-auto rounded-3xl bg-white p-5">
              <table className="w-full min-w-[480px] text-left">
                <thead className="text-sm text-slate">
                  <tr>
                    <th className="py-2 font-black">{t("metrics.month")}</th>
                    <th className="py-2 text-right font-black">{t("metrics.reviews")}</th>
                    <th className="py-2 text-right font-black">{t("metrics.verified")}</th>
                    <th className="py-2 text-right font-black">{t("metrics.users")}</th>
                    <th className="py-2 text-right font-black">{t("metrics.applications")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...metrics.months].reverse().map((m) => (
                    <tr key={m.month} className="border-t border-[#E8E6E1]">
                      <td className="py-2.5 font-black">
                        {format.dateTime(new Date(`${m.month}-01T12:00:00Z`), { year: "numeric", month: "long" })}
                      </td>
                      <td className="py-2.5 text-right">{m.reviews}</td>
                      <td className="py-2.5 text-right font-black">{m.verified}</td>
                      <td className="py-2.5 text-right">{m.users}</td>
                      <td className="py-2.5 text-right">{m.applications}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto rounded-3xl bg-white p-5">
              <h2 className="mb-2 font-black">{t("metrics.placesTitle")}</h2>
              {placesUsage.length === 0 ? (
                <p className="text-sm text-slate">{t("metrics.placesNone")}</p>
              ) : (
                <table className="w-full min-w-[420px] text-left">
                  <thead className="text-sm text-slate">
                    <tr>
                      <th className="py-2 font-black">{t("metrics.month")}</th>
                      <th className="py-2 font-black">{t("metrics.placesProvider")}</th>
                      <th className="py-2 font-black">{t("metrics.placesKind")}</th>
                      <th className="py-2 text-right font-black">{t("metrics.placesCalls")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {placesUsage.map((u) => (
                      <tr key={`${u.month}-${u.provider}-${u.kind}`} className="border-t border-[#E8E6E1]">
                        <td className="py-2.5 font-black">
                          {format.dateTime(new Date(`${u.month}T12:00:00Z`), { year: "numeric", month: "long" })}
                        </td>
                        <td className="py-2.5">{u.provider === "google" ? "Google Places" : "OpenStreetMap"}</td>
                        <td className="py-2.5">{u.kind}</td>
                        <td className="py-2.5 text-right font-black">{u.calls}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="overflow-x-auto rounded-3xl bg-white p-5">
              <h2 className="mb-2 font-black">{t("metrics.newTitle")}</h2>
              {newDays.length === 0 ? (
                <p className="text-sm text-slate">{t("empty")}</p>
              ) : (
                <table className="w-full min-w-[420px] text-left">
                  <thead className="text-sm text-slate">
                    <tr>
                      <th className="py-2 font-black">{t("metrics.day")}</th>
                      {viaKeys.map((v) => (
                        <th key={v} className="py-2 text-right font-black">
                          {t.has(`metrics.via.${v}`) ? t(`metrics.via.${v}`) : v}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {newDays.map((d) => (
                      <tr key={d} className="border-t border-[#E8E6E1]">
                        <td className="py-2.5 font-black">{format.dateTime(new Date(`${d}T12:00:00Z`), { month: "short", day: "numeric" })}</td>
                        {viaKeys.map((v) => (
                          <td key={v} className="py-2.5 text-right">
                            {newPlaces.find((r) => r.day === d && r.via === v)?.count ?? 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )
      ) : tab === "osm" && osm ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-3xl bg-white p-5">
            <h2 className="text-xl font-black">{t("osm.title")}</h2>
            <p className="text-sm text-slate">{t("osm.hint")}</p>
            <OsmImportRunner cities={OSM_CITIES.map((c) => ({ slug: c.slug, name: c.name }))} groups={OSM_GROUPS.map((g) => g.key)} />
          </div>
          <div className="overflow-x-auto rounded-3xl bg-white p-5">
            <table className="w-full min-w-[480px] text-left">
              <thead className="text-sm text-slate">
                <tr>
                  <th className="py-2 font-black">{t("osm.city")}</th>
                  <th className="py-2 text-right font-black">{t("osm.imported")}</th>
                  <th className="py-2 text-right font-black">{t("osm.unrated")}</th>
                  <th className="py-2 text-right font-black">{t("osm.gone")}</th>
                  <th className="py-2 text-right font-black">{t("osm.lastRun")}</th>
                </tr>
              </thead>
              <tbody>
                {osm.summary.map((r) => (
                  <tr key={r.city} className="border-t border-[#E8E6E1]">
                    <td className="py-2.5 font-black">
                      <Link href={{ pathname: "/admin", query: { tab: "osm", city: r.city } }} className="underline underline-offset-4">
                        {r.city}
                      </Link>
                    </td>
                    <td className="py-2.5 text-right">{r.imported}</td>
                    <td className="py-2.5 text-right">{r.unrated}</td>
                    <td className="py-2.5 text-right">{r.gone}</td>
                    <td className="py-2.5 text-right">{r.last_run ? date(r.last_run) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 rounded-3xl bg-white p-5">
            <h2 className="font-black">{t("osm.addressTitle")}</h2>
            <p className="text-sm text-slate">{t("osm.addressHint")}</p>
            {osm.addresses.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm">
                {osm.addresses.map((r) => (
                  <li key={r.city}>
                    <span className="font-black">{r.city}</span> ·{" "}
                    {t("osm.addressCounts", { pending: r.pending, found: r.found, none: r.no_address })}
                  </li>
                ))}
              </ul>
            )}
            <FillOsmAddresses />
          </div>
          <div className="flex flex-col gap-2 rounded-3xl bg-white p-5">
            <h2 className="font-black">{t("osm.log")}</h2>
            <ul className="flex flex-col divide-y divide-[#E8E6E1] text-sm">
              {osm.runs.map((r) => (
                <li key={r.id} className="py-2">
                  <span className="font-black">
                    {r.city} · {r.grp}
                  </span>{" "}
                  · {format.dateTime(new Date(r.started_at), { dateStyle: "short", timeStyle: "short" })} · {r.triggered_by ?? ""} ·{" "}
                  {r.error
                    ? r.error
                    : t("osm.line", { fetched: r.fetched, created: r.created, matched: r.matched, known: r.known, skipped: r.skipped, gone: r.gone })}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-2 rounded-3xl bg-white p-5">
            <h2 className="font-black">{t("osm.unratedTitle", { city: osmCityFilter || t("osm.allCities") })}</h2>
            <ul className="flex flex-col divide-y divide-[#E8E6E1]">
              {osm.unrated.map((l) => (
                <li key={l.id} className="py-2">
                  <Link href={`/${l.company_slug}/${l.slug}`} className="font-black underline underline-offset-4">
                    {l.name}
                  </Link>
                  <span className="text-sm text-slate">
                    {" "}
                    · {kindLabel({ type: l.place_type, en: null, hu: null }, locale, tcat(l.category))} · {l.address}, {l.city} · {l.osm_id}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : tab === "manual" && manual ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-slate">{t("manual.hint")}</p>
          {([["fresh", manual.fresh], ["hidden", manual.hidden]] as const).map(([group, rows]) =>
            group === "hidden" && rows.length === 0 ? null : (
              <div key={group} className="flex flex-col gap-3">
                <h2 className="text-xl font-black">{t(`manual.${group}`, { count: rows.length })}</h2>
                {rows.length === 0 && <p className="rounded-3xl bg-white p-5 text-slate">{t("empty")}</p>}
                {rows.map((l) => (
                  <div key={l.id} className="rounded-3xl bg-white p-5">
                    <Link href={l.path} className="font-black underline underline-offset-4">
                      {l.name}
                    </Link>
                    <p className="text-sm text-slate">
                      {l.address}, {l.city} · {tcat(l.category)} · {t("duplicates.reviews", { count: l.reviews })}
                    </p>
                    <p className="text-sm text-slate">
                      {t("manual.added", { email: l.created_by_email ?? "–", date: date(l.created_at) })} ·{" "}
                      <span className={l.geocode_status === "not_found" ? "font-black text-[#C8323C]" : ""}>
                        {t(`manual.geocode.${l.has_position ? "ok" : (l.geocode_status ?? "pending")}`)}
                      </span>
                    </p>
                    {l.dup_id && (
                      <div className="mt-2 rounded-2xl bg-paper p-3">
                        <p className="text-sm font-black text-[#C8323C]">
                          {l.dup_distance_m != null
                            ? t("manual.dupNear", { distance: Math.round(l.dup_distance_m) })
                            : t("manual.dupCity")}
                        </p>
                        <p className="text-sm">
                          <span className="font-black">A: </span>
                          {l.name} · {l.address}
                        </p>
                        <p className="text-sm">
                          <span className="font-black">B: </span>
                          <Link href={l.dup_path ?? "/"} className="font-black underline underline-offset-4">
                            {l.dup_name}
                          </Link>{" "}
                          · {l.dup_address}
                        </p>
                        <DuplicatePair a={l.id} b={l.dup_id} />
                      </div>
                    )}
                    <ManualActions id={l.id} name={l.name} address={l.address} city={l.city} hidden={!!l.hidden_at} />
                    <CategoryEditor id={l.id} category={l.category} />
                  </div>
                ))}
              </div>
            ),
          )}
        </section>
      ) : tab === "partners" && partnerKeys ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-3xl bg-white p-5">
            <h2 className="text-xl font-black">{t("partners.title")}</h2>
            <p className="text-sm text-slate">{t("partners.hint")}</p>
            <NewPartnerKey />
          </div>
          {partnerKeys.length === 0 && <p className="rounded-3xl bg-white p-5 text-slate">{t("empty")}</p>}
          {partnerKeys.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-5">
              <div className="min-w-0">
                <p className="font-black">
                  {k.name} {k.revoked_at && <span className="text-sm text-[#C8323C]">· {t("partners.revoked", { date: date(k.revoked_at) })}</span>}
                </p>
                <p className="text-sm text-slate">
                  {t("partners.meta", {
                    created: date(k.created_at),
                    used: k.last_used_at ? date(k.last_used_at) : "–",
                    uses: k.uses,
                    workplaces: k.workplaces,
                    limit: k.hourly_limit,
                  })}
                </p>
              </div>
              {!k.revoked_at && <RevokePartnerKey id={k.id} />}
            </div>
          ))}
        </section>
      ) : tab === "duplicates" && duplicates ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-slate">{t("duplicates.hint")}</p>
          {duplicates.length === 0 && <p className="rounded-3xl bg-white p-5 text-slate">{t("empty")}</p>}
          {duplicates.map((d) => (
            <div key={`${d.a}-${d.b}`} className="rounded-3xl bg-white p-5">
              <p className="text-sm text-slate">
                {t("duplicates.meta", { distance: Math.round(d.distance_m), similarity: Math.round(d.similarity * 100) })}
              </p>
              {(
                [
                  ["A", d.a_name, d.a_address, d.a_path, d.a_reviews, d.a_via],
                  ["B", d.b_name, d.b_address, d.b_path, d.b_reviews, d.b_via],
                ] as const
              ).map(([label, name, address, path, reviews, via]) => (
                <p key={label} className="mt-1">
                  <span className="font-black">{label}: </span>
                  <Link href={path} className="font-black underline underline-offset-4">
                    {name}
                  </Link>
                  <span className="text-sm text-slate">
                    {" "}
                    · {address} · {t("duplicates.reviews", { count: reviews })} · {via ?? "–"}
                  </span>
                </p>
              ))}
              <DuplicatePair a={d.a} b={d.b} />
            </div>
          ))}
        </section>
      ) : tab === "demo" ? (
        <section className="flex flex-col gap-4 rounded-3xl bg-white p-6">
          <h2 className="text-2xl font-black tracking-brand">{t("demo.title")}</h2>
          <p className="text-slate">{t("demo.body")}</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(["companies", "locations", "reviews", "jobs", "users"] as const).map((k) => (
              <li key={k} className="rounded-2xl bg-paper p-4">
                <span className="block text-3xl font-black tracking-brand">{demo?.[k] ?? 0}</span>
                <span className="text-sm text-slate">{t(`demo.counts.${k}`)}</span>
              </li>
            ))}
          </ul>
          <PurgeDemo disabled={!demo || Object.values(demo).every((n) => !n)} />
          <p className="text-sm text-slate">{t("demo.sql")}</p>
        </section>
      ) : tab === "import" ? (
        <CsvImport />
      ) : tab === "workplaces" || tab === "entities" ? (
        <section className="flex flex-col gap-4">
          <form className="flex gap-2">
            <input type="hidden" name="tab" value={tab} />
            <input
              name="q"
              defaultValue={q}
              placeholder={t("searchCompany")}
              className="min-w-0 flex-1 rounded-2xl border border-mist/60 bg-white px-4 py-3 outline-none focus:border-ink"
            />
            <button className="rounded-2xl bg-ink px-5 py-3 font-black text-paper">{t("search")}</button>
          </form>
          <p className="text-sm text-slate">{tab === "entities" ? t("entityHint") : t("slugHint")}</p>
          {tab === "entities" &&
            companies.flatMap((c) =>
              c.locations.map((l) => (
                <div key={l.id} className="rounded-3xl bg-white p-5">
                  <p className="text-lg font-black">{c.name}</p>
                  <p className="text-slate">
                    {l.address}, {l.city}
                  </p>
                  <ul className="mt-3 flex flex-col gap-2">
                    {l.location_entity_links.map((k) => (
                      <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-paper p-3">
                        <span>
                          <span className="font-black">{k.legal_entities?.name}</span>
                          {k.legal_entities?.registry_id && (
                            <span className="text-slate"> · {k.legal_entities.registry_id}</span>
                          )}
                          <span className="text-sm text-slate">
                            {" "}
                            · {t(`entitySources.${k.source}`)} ·{" "}
                            {k.verified_at ? t("entityVerified") : t("entityUnverified")}
                          </span>
                        </span>
                        {k.verified_at && <UnverifyEntity linkId={k.id} />}
                      </li>
                    ))}
                  </ul>
                  <EntityForm locationId={l.id} country={l.country} />
                </div>
              )),
            )}
          {tab === "workplaces" && (
            <>
              <RefreshPages />
              <BackfillPlaceTypes />
              {review && (
                <section className="flex flex-col gap-3 rounded-3xl bg-white p-5">
                  <h2 className="text-xl font-black">{t("reviewTitle", { count: review.length })}</h2>
                  <p className="text-sm text-slate">{t("reviewHint")}</p>
                  {review.length === 0 && <p className="text-slate">{t("empty")}</p>}
                  <ul className="flex flex-col divide-y divide-[#E8E6E1]">
                    {review.map((l) => (
                      <li key={l.id} className="py-3">
                        <p className="font-black">{l.name}</p>
                        <p className="text-sm text-slate">
                          {kindLabel({ type: l.place_type, en: l.place_type_en, hu: l.place_type_hu }, locale, tcat(l.category as string))} ·{" "}
                          {l.address}, {l.city} · {t("reviewSource", { source: l.category_source ?? "–", confidence: l.category_confidence ?? "–" })}
                        </p>
                        {l.reports.map((r, i) => (
                          <p key={i} className="mt-1 rounded-xl bg-paper px-3 py-1.5 text-sm">
                            {t("reviewReport", { category: tcat(r.category) })}
                            {r.note && ` – „${r.note}”`}
                          </p>
                        ))}
                        <CategoryEditor id={l.id} category={l.category as string} confirm />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <form className="flex gap-2">
                <input type="hidden" name="tab" value="workplaces" />
                <select
                  name="cat"
                  defaultValue={cat ?? ""}
                  aria-label={t("bulkCategory")}
                  className="min-w-0 flex-1 rounded-2xl border border-mist/60 bg-white px-4 py-3"
                >
                  <option value="">{t("bulkCategory")}</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {tcat(c)}
                    </option>
                  ))}
                </select>
                <button className="rounded-2xl bg-ink px-5 py-3 font-black text-paper">{t("search")}</button>
              </form>
              {byCategory && <BulkCategory rows={byCategory} />}
            </>
          )}
          {tab === "workplaces" && companies.map((c) => (
            <div key={c.id} className="rounded-3xl bg-white p-5">
              <p className="text-lg font-black">{c.name}</p>
              <SlugEditor kind="company" id={c.id} slug={c.slug} prefix="/" />
              <ul className="mt-3 flex flex-col gap-2 border-t border-[#E8E6E1] pt-3">
                {c.locations.map((l) => (
                  <li key={l.id}>
                    <p className="text-slate">
                      {l.address}, {l.city}
                    </p>
                    <SlugEditor kind="location" id={l.id} slug={l.slug} prefix={`/${c.slug}/`} />
                    <CategoryEditor id={l.id} category={l.category} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : items.length === 0 ? (
        <p className="rounded-3xl bg-white p-5 text-slate">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-3xl bg-white p-5">
              <p className="mb-2 text-sm text-slate">{date(item.created_at)}</p>
              {item.content}
              <Decision kind={tab as Queue} id={item.id} documentUrl={item.documentUrl} />
            </li>
          ))}
        </ul>
      )}
      {extra}
    </main>
    </>
  );
}

/** Link that opens a proof document through the logging route (60-second signed link). */
const docHref = (kind: "claim" | "review", id: string, file: "company" | "id" | "proof") =>
  `/api/admin/document?kind=${kind}&id=${id}&file=${file}`;

type DocLog = { source_id: string; created_at: string };

/** Decided documents still kept (30 days after the decision): result, deletion date, links, opens. */
async function DecidedDocuments({
  kind,
  supabase,
}: {
  kind: "claim" | "review";
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"];
}) {
  const t = await getTranslations("Admin.docs");
  const tf = await getTranslations("ReviewForm");
  const format = await getFormatter();
  const date = (iso: string | null) => (iso ? format.dateTime(new Date(iso), { dateStyle: "medium" }) : "–");
  type Row = { id: string; title: string; sub: string; result: string; decided_at: string | null; delete_at: string | null; files: { label: string; file: "company" | "id" | "proof" }[] };
  let rows: Row[] = [];
  if (kind === "claim") {
    const { data } = await supabase
      .from("claim_requests")
      .select("id, org_name, method, status, decided_at, documents_delete_at, document_path, id_document_path, locations(name, address)")
      .not("decided_at", "is", null)
      .is("documents_deleted_at", null)
      .not("documents_delete_at", "is", null)
      .order("documents_delete_at")
      .limit(100);
    rows = (data ?? []).map((c) => {
      const place = c.locations as unknown as Place;
      return {
        id: c.id,
        title: c.org_name,
        sub: [place?.name, place?.address].filter(Boolean).join(" · "),
        result: c.status === "resolved" ? t("approved") : t("rejected"),
        decided_at: c.decided_at,
        delete_at: c.documents_delete_at,
        files: [
          ...(c.document_path ? [{ label: c.method === "authorization" ? t("authorization") : t("registry"), file: "company" as const }] : []),
          ...(c.id_document_path ? [{ label: t("photoId"), file: "id" as const }] : []),
        ],
      };
    });
  } else {
    const { data } = await supabase
      .from("verifications")
      .select("id, doc_type, status, decided_at, delete_at, reviews(position, locations(name, address))")
      .not("decided_at", "is", null)
      .is("deleted_at", null)
      .not("delete_at", "is", null)
      .order("delete_at")
      .limit(100);
    rows = (data ?? []).map((v) => {
      const r = v.reviews as unknown as { position: string; locations: Place } | null;
      return {
        id: v.id,
        title: tf(`docTypes.${v.doc_type}`),
        sub: [r?.locations?.name, r?.locations?.address, r?.position].filter(Boolean).join(" · "),
        result: v.status === "approved" ? t("approved") : t("rejected"),
        decided_at: v.decided_at,
        delete_at: v.delete_at,
        files: [{ label: tf(`docTypes.${v.doc_type}`), file: "proof" as const }],
      };
    });
  }
  const { data: logs } = rows.length
    ? await supabase
        .from("document_access_log")
        .select("source_id, created_at")
        .eq("kind", kind)
        .in("source_id", rows.map((r) => r.id))
        .order("created_at", { ascending: false })
    : { data: [] };
  const opens = new Map<string, DocLog[]>();
  for (const l of (logs ?? []) as DocLog[]) opens.set(l.source_id, [...(opens.get(l.source_id) ?? []), l]);

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-black">{t("title")}</h2>
      <p className="mt-1 text-slate">{t("intro")}</p>
      {rows.length === 0 ? (
        <p className="mt-3 rounded-3xl bg-white p-5 text-slate">{t("none")}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {rows.map((r) => {
            const seen = opens.get(r.id) ?? [];
            return (
              <li key={r.id} className="rounded-3xl bg-white p-5">
                <p className="font-black">{r.title}</p>
                {r.sub && <p className="text-slate">{r.sub}</p>}
                <p className="mt-2 text-sm">
                  {t("decided", { result: r.result, date: date(r.decided_at) })} ·{" "}
                  <span className="font-black">{t("deletesOn", { date: date(r.delete_at) })}</span>
                </p>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {r.files.map((f) => (
                    <a key={f.file} href={docHref(kind, r.id, f.file)} target="_blank" rel="noreferrer" className="font-black underline underline-offset-4">
                      {f.label}
                    </a>
                  ))}
                </p>
                <p className="mt-1 text-sm text-slate">
                  {seen.length ? t("opened", { count: seen.length, date: date(seen[0].created_at) }) : t("neverOpened")}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Payment state and links to the Stripe dashboard (admin). */
function StripeLinks({ status, links }: { status: string; links: (false | null | "" | { label: string; href: string })[] }) {
  const shown = links.filter((l): l is { label: string; href: string } => Boolean(l));
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="rounded-lg border border-mist px-2 py-0.5 font-black">{status}</span>
      {shown.map((l) => (
        <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="font-black underline underline-offset-4">
          {l.label}
        </a>
      ))}
    </p>
  );
}

function ReviewSummary({ r, relationship }: { r: ReviewRow; relationship: string }) {
  return (
    <div>
      <p className="text-lg font-black">{r.locations?.name}</p>
      <p className="text-slate">
        {r.locations?.address} · {r.position} · {relationship}
        {r.overall ? ` · ${r.overall}/5` : ""}
      </p>
      {r.body && <p className="mt-2 whitespace-pre-line">{r.body}</p>}
    </div>
  );
}
