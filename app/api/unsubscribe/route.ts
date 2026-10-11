import { publicClient } from "@/lib/data/supabase";

// One-click unsubscribe (RFC 8058) from the List-Unsubscribe header of invite emails.
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  if (!/^[\w-]{8,64}$/.test(token)) return new Response("Bad request", { status: 400 });
  await publicClient().rpc("invite_unsubscribe", { p_token: token });
  return new Response("OK");
}
