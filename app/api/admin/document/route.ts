import { getUser } from "@/lib/auth";

// An admin opens a proof document (access request or review): admin_open_document() checks the
// admin, logs who opened which file and when, and returns where it is; the file itself is served
// through a signed link that expires after 60 seconds. Deleted files (30 days after the decision)
// can't be opened any more.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "";
  const id = url.searchParams.get("id") ?? "";
  const file = url.searchParams.get("file") ?? "";
  const { supabase, user } = await getUser();
  if (!user || !/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const { data, error } = await supabase.rpc("admin_open_document", { p_kind: kind, p_id: id, p_file: file });
  const doc = (data as { bucket: string; path: string }[] | null)?.[0];
  if (error || !doc) return new Response("Not found", { status: 404 });
  const { data: signed } = await supabase.storage.from(doc.bucket).createSignedUrl(doc.path, 60);
  if (!signed?.signedUrl) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 302, headers: { Location: signed.signedUrl, "Cache-Control": "no-store" } });
}
