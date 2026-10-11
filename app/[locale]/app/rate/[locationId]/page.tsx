import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ReviewForm } from "@/components/app/review-form";
import { getPathname } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";
import { getLocationById } from "@/lib/data";
import { locationPath } from "@/lib/format";

export const instant = false;

export default async function RatePage({ params, searchParams }: PageProps<"/[locale]/app/rate/[locationId]">) {
  const { locale, locationId } = await params;
  const { invite } = await searchParams;
  const inviteToken = typeof invite === "string" && /^[\w-]{8,64}$/.test(invite) ? invite : undefined;
  setRequestLocale(locale);
  const location = await getLocationById(locationId);
  if (!location) notFound();

  const self = `/app/rate/${locationId}${inviteToken ? `?invite=${inviteToken}` : ""}`;
  // Anyone can fill in the review; signing in is the last step.
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

  const selfPath = getPathname({ href: self, locale });
  return (
    <ReviewForm
      userId={user?.id ?? null}
      inviteToken={inviteToken}
      location={{ id: location.id, name: location.name, address: location.address }}
      displayName={displayName}
      changeNameHref={getPathname({
        href: { pathname: "/app/welcome", query: { next: selfPath, edit: "1" } },
        locale,
      })}
      locationHref={getPathname({ href: locationPath(location), locale })}
      returnPath={selfPath}
      welcomePath={getPathname({ href: "/app/welcome", locale })}
      sentPath={getPathname({ href: "/app/rate/sent", locale })}
    />
  );
}
