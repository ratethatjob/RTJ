import { getTranslations, setRequestLocale } from "next-intl/server";
import { JoinTeam } from "@/components/business/join-team";
import { getBusiness } from "@/lib/business";

export const instant = false;

export default async function JoinPage({ params }: PageProps<"/[locale]/business/join/[token]">) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const { supabase } = await getBusiness(locale, `/business/join/${token}`);
  const t = await getTranslations("Team");
  const tb = await getTranslations("Business");
  const { data } = await supabase.rpc("member_invite_info", { p_token: token });
  const invite = (data as { org_name: string; role: string; valid: boolean }[] | null)?.[0];

  return (
    <main className="flex w-full max-w-md flex-1 flex-col justify-center gap-4 py-12">
      {invite?.valid ? (
        <>
          <h1 className="text-4xl font-black tracking-brand">{t("joinTitle", { org: invite.org_name })}</h1>
          <p className="text-lg text-slate">
            {t("joinBody", { role: tb(`roles.${invite.role}`) })} {tb(`roleDescriptions.${invite.role}`)}.
          </p>
          <JoinTeam token={token} />
        </>
      ) : (
        <p className="rounded-3xl bg-white p-6 text-lg">{t("invalid")}</p>
      )}
    </main>
  );
}
