import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip API, embeds, invite redirects, Next internals and files with an extension
  matcher: "/((?!api|embed|r/|_next|_vercel|.*\\..*).*)",
};
