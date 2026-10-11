import { getPathname, redirect } from "@/i18n/navigation";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** The signed-in user from the session's JWT, verified locally (asymmetric signing keys, cached
 *  JWKS) – no round trip to Supabase Auth. Row access is still enforced by RLS with the same JWT. */
export type AuthUser = { id: string; email?: string; phone?: string };

export async function getUser() {
  const supabase = await createClient();
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase is not configured");
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const user: AuthUser | null = claims?.sub
    ? {
        id: claims.sub,
        email: typeof claims.email === "string" && claims.email ? claims.email : undefined,
        phone: typeof claims.phone === "string" && claims.phone ? claims.phone : undefined,
      }
    : null;
  return { supabase, user };
}

/** Redirects to sign-in (then back to `path`) when nobody is signed in. */
export async function requireUser(locale: string, path: string) {
  const { supabase, user } = await getUser();
  if (!user) {
    redirect({
      href: {
        pathname: "/app/sign-in",
        // Employer pages get the employer sign-in (work email code only).
        query: { next: getPathname({ href: path, locale }), ...(path.startsWith("/business") && { for: "business" }) },
      },
      locale,
    });
  }
  return { supabase, user: user! };
}

/** Same-site relative path from a ?next= parameter. */
export function safeNext(value: unknown, fallback = "/") {
  return typeof value === "string" && /^\/(?![/\\])/.test(value)
    ? value
    : fallback;
}
