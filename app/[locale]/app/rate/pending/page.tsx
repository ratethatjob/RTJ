import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ReviewForm } from "@/components/app/review-form";
import { getPathname } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";
import { parsePendingWorkplace } from "@/lib/workplaces";

export const instant = false;

// Review of a workplace that isn't on RateThatJob yet: picked on the map (?place=&name=&address=)
// or typed in (?company=&address=&city=&country=). It is created only when the review is sent.
export default async function PendingRatePage({ params, searchParams }: PageProps<"/[locale]/app/rate/pending">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const q = await searchParams;
  const str = (k: string) => (typeof q[k] === "string" ? (q[k] as string) : "");
  const workplace = parsePendingWorkplace(
    q.place
      ? { kind: "place", placeId: str("place"), category: str("category") }
      : {
          kind: "manual",
          company: str("company"),
          address: str("address"),
          city: str("city"),
          country: str("country"),
          category: str("category"),
        },
  );
  if (!workplace) notFound();
  // Shown to the person only; the place itself is fetched again from the map on sending.
  const name = workplace.kind === "place" ? str("name").slice(0, 120) : workplace.company;
  const address =
    workplace.kind === "place" ? str("address").slice(0, 200) : `${workplace.address}, ${workplace.city}`;

  const { supabase, user } = await getUser();
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("display_mode, generated_name, username")
        .eq("user_id", user.id)
        .single()
    : { data: null };
  const displayName = !user
    ? null
    : (profile?.display_mode === "username" ? profile.username : profile?.generated_name) ?? "";

  const query = Object.fromEntries(
    Object.entries(q).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
  const selfPath = getPathname({ href: { pathname: "/app/rate/pending", query }, locale });
  return (
    <ReviewForm
      userId={user?.id ?? null}
      location={{ id: null, name: name || "–", address }}
      workplace={workplace}
      displayName={displayName}
      changeNameHref={getPathname({
        href: { pathname: "/app/welcome", query: { next: selfPath, edit: "1" } },
        locale,
      })}
      locationHref={getPathname({ href: "/app/rate", locale })}
      returnPath={selfPath}
      welcomePath={getPathname({ href: "/app/welcome", locale })}
    />
  );
}
