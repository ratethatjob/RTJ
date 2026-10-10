// Best-effort fixed-window limit per key, kept in the memory of each server instance.
// Public endpoints are also cached, so this only stops a single client hammering one instance.

const hits = new Map<string, { count: number; reset: number }>();

export function rateLimited(key: string, limit = 120, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.reset <= now) {
    if (hits.size > 10_000) hits.clear();
    hits.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

/** The caller's IP as seen by Vercel's edge. */
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}
