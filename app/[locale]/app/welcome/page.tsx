import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { BackLink } from "@/components/app/back-link";
import { DisplayNameForm } from "@/components/app/display-name-form";
import { requireUser, safeNext } from "@/lib/auth";

export const instant = false;

export default async function WelcomePage({ params, searchParams }: PageProps<"/[locale]/app/welcome">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const next = safeNext(query.next, getPathname({ href: "/", locale }));
  const editing = query.edit === "1";

  const { supabase, user } = await requireUser(
    locale,
    `/app/welcome?next=${encodeURIComponent(next)}${editing ? "&edit=1" : ""}`,
  );
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_mode, generated_name, username, name_confirmed_at")
    .eq("user_id", user.id)
    .single();

  // Name already chosen: carry on, unless the user came here to change it.
  if (profile?.name_confirmed_at && !editing) redirect(next);

  const t = await getTranslations("Welcome");
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-4">
      <BackLink href={next} />
      <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-brand">{t("title")}</h1>
      <p className="mt-3 text-lg text-slate">{t("subtitle")}</p>
      <DisplayNameForm
        next={next}
        initialMode={profile?.display_mode ?? "generated"}
        initialGenerated={profile?.generated_name ?? ""}
        initialUsername={profile?.username ?? ""}
      />
    </main>
  );
}
