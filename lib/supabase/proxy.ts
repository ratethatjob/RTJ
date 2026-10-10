import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { supabaseKey, supabaseUrl } from "./env";

// Refreshes the Supabase session cookie on the given response.
export async function refreshSession(request: NextRequest, response: NextResponse) {
  if (!supabaseUrl || !supabaseKey) return response;
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}
