import { moderateUnchecked, translateMissing } from "@/lib/translation-jobs";

// Daily: the AI check for reviews that missed it, then translations that failed or were added
// before the API key existed.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const moderated = await moderateUnchecked();
  return Response.json({ moderated, ...(await translateMissing()) });
}
