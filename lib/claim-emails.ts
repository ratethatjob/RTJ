import { getTranslations } from "next-intl/server";
import { sendEmail } from "./email";
import { SITE_URL } from "./seo";

// Emails to the person who claimed a workplace: more info needed, approved, rejected.
// Sent to their signed-in (code-verified) address in the language they claimed in.

export type ClaimMail = { email: string | null; locale: string; location: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** First steps after approval: pages every new employer has (no plan needed). */
const STEPS = [
  { key: "profile", path: "/business/profile" },
  { key: "invite", path: "/business/invite" },
  { key: "billing", path: "/business/billing" },
] as const;

export async function sendClaimEmail(
  claim: ClaimMail,
  kind: "info" | "approved" | "rejected",
  message = "",
): Promise<boolean> {
  if (!claim.email) return false;
  const locale = claim.locale === "hu" ? "hu" : "en";
  const t = await getTranslations({ locale, namespace: "ClaimEmail" });
  const base = `${SITE_URL}${locale === "en" ? "" : `/${locale}`}`;
  const link = `${base}/business`;
  const values = { location: claim.location, link, message };
  if (kind !== "approved") return sendEmail(claim.email, t(`${kind}Subject`, values), t(`${kind}Body`, values));

  const signature = `RateThatJob – ${(await getTranslations({ locale, namespace: "Metadata" }))("tagline")}`;
  const steps = STEPS.map((s) => ({ text: t(`steps.${s.key}`), href: `${base}${s.path}` }));
  const text = `${t("approvedBody", values)}\n\n${t("stepsTitle")}\n${steps.map((s, i) => `${i + 1}. ${s.text}: ${s.href}`).join("\n")}\n\n${signature}`;
  const html = `<!doctype html><html><body style="margin:0;background:#F4F2EE;font-family:Arial,Helvetica,sans-serif;color:#14161A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F2EE"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:24px">
<tr><td style="padding:32px 28px">
<p style="margin:0 0 8px;font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#4A4F57">RateThatJob</p>
<h1 style="margin:0 0 16px;font-size:26px;line-height:1.2">${esc(t("approvedTitle", values))}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#4A4F57">${esc(t("approvedIntro", values))}</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:16px;background:#14161A">
<a href="${esc(link)}" style="display:inline-block;padding:16px 28px;font-size:18px;font-weight:bold;color:#ffffff;text-decoration:none">${esc(t("approvedButton"))}</a>
</td></tr></table>
<h2 style="margin:32px 0 12px;font-size:18px">${esc(t("stepsTitle"))}</h2>
<ol style="margin:0;padding-left:20px;font-size:16px;line-height:1.6">
${steps.map((s) => `<li style="margin-bottom:8px"><a href="${esc(s.href)}" style="color:#14161A;font-weight:bold">${esc(s.text)}</a></li>`).join("\n")}
</ol>
<p style="margin:28px 0 0;font-size:13px;color:#4A4F57">${esc(t("approvedLink"))} <a href="${esc(link)}" style="color:#14161A">${esc(link)}</a></p>
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#4A4F57">${signature}</p>
</td></tr></table></body></html>`;
  return sendEmail(claim.email, t("approvedSubject", values), text, html);
}
