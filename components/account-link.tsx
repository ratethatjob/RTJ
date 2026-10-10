"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

/** "Sign in" for visitors, "My account" once signed in. Checked in the
 * browser so public pages stay static and cacheable. */
export function AccountLink({ signInLabel }: { signInLabel: string }) {
  const t = useTranslations("NavAccount");
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    try {
      createClient()
        .auth.getSession()
        .then(({ data }) => setSignedIn(Boolean(data.session)));
    } catch {}
  }, []);
  return (
    <Link href={signedIn ? "/app/account" : "/app/sign-in"} className="whitespace-nowrap px-1">
      {signedIn ? t("account") : signInLabel}
    </Link>
  );
}
