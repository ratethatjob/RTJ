import { getTranslations } from "next-intl/server";
import { sendEmail } from "./email";
import { SITE_URL } from "./seo";

// Emails to the person who claimed a workplace: more info needed, approved, rejected.
// Sent to their signed-in (code-verified) address in the language they claimed in.

export type ClaimMail = { email: string | null; locale: string; location: string };

export async function sendClaimEmail(
  claim: ClaimMail,
  kind: "info" | "approved" | "rejected",
  message = "",
): Promise<boolean> {
  if (!claim.email) return false;
  const locale = claim.locale === "hu" ? "hu" : "en";
  const t = await getTranslations({ locale, namespace: "ClaimEmail" });
  const link = `${SITE_URL}${locale === "en" ? "" : `/${locale}`}/business`;
  const values = { location: claim.location, link, message };
  return sendEmail(claim.email, t(`${kind}Subject`, values), t(`${kind}Body`, values));
}
