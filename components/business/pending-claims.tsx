import { getFormatter, getTranslations } from "next-intl/server";
import { ClaimReply } from "@/components/business/claim-reply";
import type { createClient } from "@/lib/supabase/server";

type Message = { id: string; from_admin: boolean; body: string; created_at: string };
type Claim = {
  id: string;
  created_at: string;
  document_path: string | null;
  locations: { name: string; address: string } | null;
  claim_messages: Message[];
};

/** The person's open claims, with our questions and their answers. */
export async function PendingClaims({
  supabase,
  userId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}) {
  const { data } = await supabase
    .from("claim_requests")
    .select("id, created_at, document_path, locations(name, address), claim_messages(id, from_admin, body, created_at)")
    .eq("user_id", userId)
    .eq("status", "open")
    .order("created_at");
  const claims = (data ?? []) as unknown as Claim[];
  if (!claims.length) return null;
  const t = await getTranslations("Business");
  const format = await getFormatter();

  return (
    <section className="mt-10">
      <h2 className="text-sm font-black uppercase tracking-tagline text-slate">{t("pendingClaims")}</h2>
      <ul className="mt-3 flex flex-col gap-3">
        {claims.map((c) => {
          const messages = [...c.claim_messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
          const waiting = messages.at(-1)?.from_admin;
          return (
            <li key={c.id} className="rounded-2xl bg-white p-4">
              <p>
                <span className="font-black">{c.locations?.name}</span> · {c.locations?.address}
              </p>
              <p className="mt-1 text-sm text-slate">
                {waiting ? t("claimNeedsInfo") : t("claimChecking")}
                {c.document_path ? ` · ${t("claimDocumentReceived")}` : ""}
              </p>
              {messages.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2">
                  {messages.map((m) => (
                    <li key={m.id} className={`rounded-2xl p-3 ${m.from_admin ? "bg-ink text-paper" : "bg-paper"}`}>
                      <p className={`text-xs font-black uppercase tracking-tagline ${m.from_admin ? "text-mist" : "text-slate"}`}>
                        {m.from_admin ? t("claimFromUs") : t("claimFromYou")} ·{" "}
                        {format.dateTime(new Date(m.created_at), { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                      <p className="mt-1 whitespace-pre-line break-words">{m.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              {waiting && <ClaimReply claimId={c.id} userId={userId} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
