import { publicClient } from "@/lib/data/supabase";
import { SITE_URL } from "@/lib/seo";

// One-click unsubscribe (RFC 8058) from the List-Unsubscribe header of invite emails.
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  if (!/^[\w-]{8,64}$/.test(token)) return new Response("Bad request", { status: 400 });
  await publicClient().rpc("invite_unsubscribe", { p_token: token });
  return new Response("OK");
}

// Mail apps without one-click support open the same address: show the unsubscribe page.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  if (!/^[\w-]{8,64}$/.test(token)) return new Response("Bad request", { status: 400 });
  return Response.redirect(`${SITE_URL}/r/${token}/unsubscribe`, 303);
}
