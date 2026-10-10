import { getPathname, redirect } from "@/i18n/navigation";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function getUser() {
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase is not configured");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Redirects to sign-in (then back to `path`) when nobody is signed in. */
export async function requireUser(locale: string, path: string) {
  const { supabase, user } = await getUser();
  if (!user) {
    redirect({
      href: { pathname: "/app/sign-in", query: { next: getPathname({ href: path, locale }) } },
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
