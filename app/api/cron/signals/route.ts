import { refreshEarlySignals } from "@/lib/early-signals-job";

// Daily: early signals for Pro locations (anonymous themes from reviews not live yet).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await refreshEarlySignals());
}
