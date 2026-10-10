import { getUser } from "@/lib/auth";

// Data export (SPEC 10): the signed-in user's profile and reviews as JSON.
export async function GET() {
  const { supabase, user } = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const [{ data: profile }, { data: reviews }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    supabase.from("reviews").select("*, locations(name, address, city)").eq("user_id", user.id),
  ]);
  const body = JSON.stringify(
    { exported_at: new Date().toISOString(), email: user.email, phone: user.phone, profile, reviews },
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
