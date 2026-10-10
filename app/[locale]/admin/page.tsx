import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { CsvImport, EntityForm, SlugEditor, UnverifyEntity } from "@/components/admin/tools";
import { Decision } from "@/components/admin/decision";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { jobPricing } from "@/lib/site-config";

export const instant = false;

const TABS = ["claims", "moderation", "verifications", "disputes", "reports", "orders"] as const;
const TOOLS = ["metrics", "workplaces", "entities", "import"] as const;
type Queue = (typeof TABS)[number];
type Tab = Queue | (typeof TOOLS)[number];

type Place = { name: string; address: string } | null;
type OrderRow = {
  id: string;
  created_at: string;
  tier: "standard" | "basic" | "pro";
  previous_tier: "standard" | "basic" | "pro" | null;
  job_title: string;
  location: string;
  address: string;
  country: string;
  org_name: string;
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
  const { tab: rawTab, q: rawQ } = await searchParams;
  const tab: Tab = [...TABS, ...TOOLS].includes(rawTab as Tab) ? (rawTab as Tab) : "claims";
  const q = typeof rawQ === "string" ? rawQ.trim().slice(0, 80) : "";
  const { supabase, user } = await requireUser(locale, "/admin");
  const t = await getTranslations("Admin");
  const tb = await getTranslations("Business");
  const tr = await getTranslations("Review");
  const tf = await getTranslations("ReviewForm");
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
    supabase.rpc("admin_job_orders").then((r) => ({ count: ((r.data ?? []) as OrderRow[]).length, data: r.data })),
  ]);

  const reviewCols = "id, position, relationship, overall, body, verification_level, locations(name, address)";
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });

  let items: { id: string; created_at: string; content: React.ReactNode; documentUrl?: string | null }[] = [];

  if (tab === "claims") {
    const { data } = await supabase
      .from("claim_requests")
      .select("id, created_at, org_name, contact_name, job_title, business_email, phone, method, note, locations(name, address)")
      .eq("status", "open")
      .order("created_at");
    items = (data ?? []).map((c) => {
      const place = c.locations as unknown as Place;
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
              {c.business_email && (<><dt className="font-black">{tb("businessEmail")}</dt><dd className="break-all">{c.business_email}</dd></>)}
              {c.phone && (<><dt className="font-black">{tb("phone")}</dt><dd>{c.phone}</dd></>)}
              {c.note && (<><dt className="font-black">{tb("note")}</dt><dd className="whitespace-pre-line">{c.note}</dd></>)}
            </dl>
          </>
        ),
      };
    });
  } else if (tab === "moderation") {
    const { data } = await supabase
      .from("reviews")
      .select(`${reviewCols}, created_at, hold_reason`)
      .eq("status", "pending_moderation")
      .order("created_at");
    const holdLabel = (reason: string) =>
      reason.startsWith("ai:")
        ? `${t("holdReasons.ai")}: ${reason
            .slice(3)
            .split(",")
            .map((x) => (t.has(`aiReasons.${x}`) ? t(`aiReasons.${x}`) : x))
            .join(", ")}`
        : t.has(`holdReasons.${reason}`)
          ? t(`holdReasons.${reason}`)
          : reason;
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
    const paths = (data ?? []).map((v) => v.storage_path).filter((p): p is string => Boolean(p));
    const { data: signed } = paths.length
      ? await supabase.storage.from("verifications").createSignedUrls(paths, 600)
      : { data: [] };
    const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    items = (data ?? []).map((v) => {
      const r = v.reviews as unknown as ReviewRow;
      return {
        id: v.id,
        created_at: v.created_at,
        documentUrl: v.storage_path ? urls.get(v.storage_path) : null,
        content: (
          <>
            <p className="mb-2 inline-block rounded-lg border border-mist px-2.5 py-1 text-sm font-black">
              {tf(`docTypes.${v.doc_type}`)}
            </p>
            {r && <ReviewSummary r={r} relationship={tr(`relationship.${r.relationship}`)} />}
          </>
        ),
      };
    });
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
            <p className="whitespace-pre-line rounded-2xl bg-paper p-4">{d.reason}</p>
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
    items = ((counts[5].data ?? []) as OrderRow[]).map((o) => {
      const pricing = jobPricing(o.country);
      const amount = pricing.prices[o.tier] - (o.previous_tier ? pricing.prices[o.previous_tier] : 0);
      return {
        id: o.id,
        created_at: o.created_at,
        content: (
          <>
            <p className="text-lg font-black">
              {tj(`packages.${o.tier}.name`)}
              {o.previous_tier && ` (${t("orderUpgrade", { from: tj(`packages.${o.previous_tier}.name`) })})`} ·{" "}
              {format.number(amount, { style: "currency", currency: pricing.currency, maximumFractionDigits: 0 })}
            </p>
            <p>
              {o.job_title} · {o.location}, {o.address}
            </p>
            <p className="text-slate">{o.org_name}</p>
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
            <p className="whitespace-pre-line rounded-2xl bg-paper p-4">{d.reason}</p>
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
              "id, name, slug, locations(id, slug, address, city, country, location_entity_links(id, source, verified_at, legal_entities(name, registry_id)))",
            )
            .ilike("name", `%${q.replace(/[%_\\,()]/g, " ")}%`)
            .order("name")
            .limit(20)
        ).data ?? []) as unknown as CompanyRow[])
      : [];

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
  const metrics = tab === "metrics" ? ((await supabase.rpc("admin_metrics")).data as Metrics | null) : null;
  const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "–");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pb-12 pt-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-4xl font-black tracking-brand">{t("title")}</h1>
        <Link href="/app/account" className="font-black underline underline-offset-4">
          ←
        </Link>
      </header>
      <nav className="-mx-4 flex flex-wrap gap-2 px-4">
        {TABS.map((key, i) => (
          <Link
            key={key}
            href={{ pathname: "/admin", query: { tab: key } }}
            aria-current={key === tab ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 font-black ${
              key === tab ? "bg-ink text-paper" : "bg-white"
            }`}
          >
            {t(`tabs.${key}`)}
            <span className={`rounded-full px-2 text-sm ${key === tab ? "bg-signal text-ink" : "bg-paper"}`}>
              {counts[i].count ?? 0}
            </span>
          </Link>
        ))}
        {TOOLS.map((key) => (
          <Link
            key={key}
            href={{ pathname: "/admin", query: { tab: key } }}
            aria-current={key === tab ? "page" : undefined}
            className={`shrink-0 rounded-xl px-4 py-2.5 font-black ${key === tab ? "bg-ink text-paper" : "border border-mist/60"}`}
          >
            {t(`tabs.${key}`)}
          </Link>
        ))}
      </nav>
      {tab === "metrics" ? (
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
          </section>
        )
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
    </main>
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
