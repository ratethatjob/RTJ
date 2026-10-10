import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { refreshSession } from "./lib/supabase/proxy";

const intl = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const response = intl(request);
  // Only signed-in areas need the session; public pages stay cacheable.
  if (/^\/(?:[a-z]{2}\/)?app(?:\/|$)/.test(request.nextUrl.pathname)) {
    return refreshSession(request, response);
  }
  return response;
}

export const config = {
  // Skip API, auth callbacks, embeds, invite redirects, Next internals and files with an extension
  matcher: "/((?!api|auth|embed|r/|_next|_vercel|.*\\..*).*)",
};
