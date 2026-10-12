import { refreshQueuedPages } from "@/lib/page-refresh";
import { rateLimited } from "@/lib/rate-limit";

// Pinged by the database (pg_net) when reviews go live or come down, and once a day by the Vercel
// cron for anything a lost ping left behind. It only takes what the database queued, so it needs
// no secret; the limit keeps it from being hammered.
async function handle() {
  if (rateLimited("revalidate", 60, 60_000)) return new Response("Too many requests", { status: 429 });
  return Response.json(await refreshQueuedPages());
}

export const GET = handle;
export const POST = handle;
