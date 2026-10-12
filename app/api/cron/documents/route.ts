import { deleteDueDocuments } from "@/lib/document-retention";

// Daily: proof documents 30 days after the decision are deleted (lib/document-retention.ts).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await deleteDueDocuments());
}
