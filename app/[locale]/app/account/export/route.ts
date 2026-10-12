import { getUser } from "@/lib/auth";

// Data export (SPEC 10): everything the signed-in user gave us, as JSON (what RLS lets them read).
export async function GET() {
  const { supabase, user } = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const [{ data: profile }, { data: rows }, { data: applications }, { data: follows }, { data: notifications }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
      supabase.from("reviews").select("*, locations(name, address, city)").eq("user_id", user.id),
      supabase
        .from("job_applications")
        .select("*, jobs(title), application_messages(*), application_followups(*)")
        .eq("user_id", user.id),
      supabase.from("follows").select("created_at, locations(name, address, city)").eq("user_id", user.id),
      supabase.from("notifications").select("kind, data, created_at, read_at").eq("user_id", user.id),
    ]);
  // Internal moderation fields stay out.
  const reviews = (rows ?? []).map((r) => {
    const copy = { ...r };
    delete copy.hold_reason;
    delete copy.ai_checked_at;
    return copy;
  });
  const body = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      email: user.email,
      phone: user.phone,
      profile,
      reviews,
      applications,
      follows,
      notifications,
    },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="ratethatjob-data.json"',
      "cache-control": "no-store",
    },
  });
}
