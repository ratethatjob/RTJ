import { translateMissing } from "@/lib/translation-jobs";

// Daily backfill for translations that failed or were added before the API key existed.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await translateMissing());
}
