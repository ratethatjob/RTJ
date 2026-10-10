import { getTranslations } from "next-intl/server";
import { sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/seo";
import { adminClient } from "@/lib/supabase/admin";

// Daily: emails the Pro trial notices (written in-app by process_trials()) to owners and HR.
// Needs SUPABASE_SECRET_KEY and RESEND_API_KEY; without them the notices stay in-app only.
const KINDS = ["trial_ending", "trial_ended"];

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const db = adminClient();
  if (!db || !process.env.RESEND_API_KEY) return Response.json({ sent: 0, skipped: "not configured" });

  const since = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const { data: rows } = await db
    .from("notifications")
    .select("id, user_id, kind, data")
    .in("kind", KINDS)
    .is("emailed_at", null)
    .gte("created_at", since)
    .limit(200);

  let sent = 0;
  for (const n of rows ?? []) {
    const { data: user } = await db.auth.admin.getUserById(n.user_id);
    const email = user.user?.email;
    if (email) {
      const { data: profile } = await db.from("profiles").select("preferred_locale").eq("user_id", n.user_id).maybeSingle();
      const locale = profile?.preferred_locale === "hu" ? "hu" : "en";
      const t = await getTranslations({ locale, namespace: "Email" });
      const data = n.data as { location?: string; days?: number };
      const values = { location: data.location ?? "", days: data.days ?? 0 };
      const link = `${SITE_URL}${locale === "en" ? "" : `/${locale}`}/business/locations#plan`;
      const ok = await sendEmail(
        email,
        t(`${n.kind}Subject`, values),
        t(`${n.kind}Body`, { ...values, link }),
      );
      if (ok) sent += 1;
    }
    // Marked either way so a missing address doesn't retry forever.
    await db.from("notifications").update({ emailed_at: new Date().toISOString() }).eq("id", n.id);
  }
  return Response.json({ sent });
}
