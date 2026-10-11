import { AccountShell } from "@/components/app/account-shell";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { OrgCard } from "@/components/business-access";
import { AccountActions, JobAlertsToggle, JobEndedForm } from "@/components/app/account-actions";
import { getPathname, Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { initials } from "@/lib/format";
import { getMembership } from "@/lib/membership";

export const instant = false;

type Row = {
  id: string;
  status: string;
  relationship: string;
  publish_mode: string;
  publish_at: string | null;
  period_start: string;
  position: string;
  overall: number | null;
  created_at: string;
  locations: { name: string; address: string } | null;
};

export default async function AccountPage({ params }: PageProps<"/[locale]/app/account">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, user } = await requireUser(locale, "/app/account");
  const [{ data: profile }, { data: rows }, { data: admin }, { data: follows }] = await Promise.all([
    supabase.from("profiles").select("display_mode, generated_name, username, job_alerts").eq("user_id", user.id).single(),
    supabase
      .from("reviews")
      .select("id, status, relationship, publish_mode, publish_at, period_start, position, overall, created_at, locations(name, address)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("follows")
      .select("location_id, locations(name, address, slug, companies(slug))")
      .eq("active", true)
      .order("created_at", { ascending: false }),
  ]);
  const followed = (follows ?? []) as unknown as {
    location_id: string;
    locations: { name: string; address: string; slug: string; companies: { slug: string } | null } | null;
  }[];
  const [t, tb, membership] = await Promise.all([getTranslations("Account"), getTranslations("BusinessAccess"), getMembership()]);
  const format = await getFormatter();
  const name = profile?.display_mode === "username" ? profile.username : profile?.generated_name;
  const self = getPathname({ href: "/app/account", locale });
  const reviews = (rows ?? []) as unknown as Row[];

  return (
    <AccountShell active="account" back={getPathname({ href: "/", locale })}>
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-4xl font-black tracking-brand">{t("title")}</h1>
        {admin && (
          <Link href="/admin" className="rounded-xl bg-ink px-4 py-2 font-black text-paper">
            {t("admin")}
          </Link>
        )}
      </header>

      {membership && (
        <OrgCard
          name={membership.orgName}
          label={tb("managing", { org: membership.orgName })}
          cta={tb("openDashboard")}
        />
      )}

      <section className="flex items-center gap-3 rounded-3xl bg-white p-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#E8E6E1] font-black">
          {initials(name || "?")}
        </span>
        <span className="flex-1 text-slate">
          {t.rich("shownAs", { name: () => <strong className="font-black text-ink">{name}</strong> })}
        </span>
        <Link
          href={{ pathname: "/app/welcome", query: { next: self, edit: "1" } }}
          className="font-black underline underline-offset-4"
        >
          {t("change")}
        </Link>
      </section>

      <Link href="/app/applications" className="flex items-center justify-between rounded-3xl bg-white p-5 font-black lg:hidden">
        {t("applications")}
        <span aria-hidden>→</span>
      </Link>

      <section>
        <h2 className="mb-3 text-2xl font-black tracking-brand">{t("myReviews")}</h2>
        {reviews.length === 0 ? (
          <p className="rounded-3xl bg-white p-5 text-slate">
            {t("noReviews")}{" "}
            <Link href="/app/rate" className="font-black text-ink underline underline-offset-4">
              {t("rateOne")}
            </Link>
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {reviews.map((r) => {
              const waiting = r.status === "scheduled" && !r.publish_at;
              return (
                <li key={r.id} className="rounded-3xl bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black">{r.locations?.name}</p>
                      <p className="text-slate">
                        {r.locations?.address} · {r.position}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-black ${
                        r.status === "published" ? "bg-signal" : "border border-mist"
                      }`}
                    >
                      {t(`status.${r.status}`)}
                    </span>
                  </div>
                  {waiting && <p className="mt-2 text-slate">{t("waitingForLeave")}</p>}
                  {r.status === "scheduled" && r.publish_at && (
                    <p className="mt-2 text-slate">
                      {t("goesLiveOn", { date: format.dateTime(new Date(r.publish_at), { dateStyle: "medium" }) })}
                    </p>
                  )}
                  {r.relationship === "current" && r.publish_mode === "after_leaving" && (
                    <JobEndedForm reviewId={r.id} min={r.period_start.slice(0, 7)} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-black tracking-brand">{t("following")}</h2>
        {followed.length === 0 ? (
          <p className="rounded-3xl bg-white p-5 text-slate">{t("noFollowing")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {followed.map((f) => (
              <li key={f.location_id}>
                <Link
                  href={`/${f.locations?.companies?.slug}/${f.locations?.slug}`}
                  className="block rounded-3xl bg-white p-5"
                >
                  <span className="block font-black">{f.locations?.name}</span>
                  <span className="text-slate">{f.locations?.address}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <JobAlertsToggle initial={Boolean(profile?.job_alerts)} />

      <AccountActions exportHref={`${self}/export`} home={getPathname({ href: "/", locale })} />
    </AccountShell>
  );
}
