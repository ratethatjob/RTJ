import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Completes OAuth sign-in (?code=) and email links (?token_hash=&type=).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safePath(searchParams.get("next"));
  const supabase = await createClient();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code") };

  // Employer pages: back to the employer sign-in on error, and no reviewer display-name step.
  const business = /^\/(?:hu\/)?business(?:[/?]|$)/.test(next);
  if (error) {
    return NextResponse.redirect(
      `${origin}/app/sign-in?error=1&next=${encodeURIComponent(next)}${business ? "&for=business" : ""}`,
    );
  }
  return NextResponse.redirect(`${origin}${business ? next : welcomePath(next)}`);
}

// Only same-site relative paths.
function safePath(path: string | null) {
  return path && /^\/(?![/\\])/.test(path) ? path : "/";
}

function welcomePath(next: string) {
  const locale = next.match(/^\/(hu)(?:\/|$)/)?.[1];
  return `${locale ? `/${locale}` : ""}/app/welcome?next=${encodeURIComponent(next)}`;
}
