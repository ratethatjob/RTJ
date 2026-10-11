// Checks for workplace claims: is the website a real http(s) address, and does the
// signed-in email's domain belong to it? Free email providers never count as a match.

const FREEMAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "ymail.com", "outlook.com", "hotmail.com",
  "hotmail.co.uk", "live.com", "msn.com", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me",
  "protonmail.com", "gmx.com", "gmx.net", "gmx.de", "web.de", "mail.com", "yandex.com", "yandex.ru",
  "zoho.com", "tutanota.com", "fastmail.com", "freemail.hu", "citromail.hu", "t-online.hu", "t-online.de",
  "vipmail.hu", "indamail.hu", "outlook.hu", "hotmail.hu", "gmail.hu",
]);

/** The website as an absolute http(s) URL, or null. Adds https:// when missing. */
export function normalizeWebsite(value: string): string | null {
  const v = value.trim();
  if (!v || v.length > 200) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export type DomainCheck = { emailDomain: string; siteHost: string | null; match: boolean; freemail: boolean };

export function domainCheck(email: string | null, website: string | null): DomainCheck | null {
  const emailDomain = email?.split("@")[1]?.toLowerCase().trim();
  if (!emailDomain) return null;
  const freemail = FREEMAIL.has(emailDomain);
  let siteHost: string | null = null;
  try {
    siteHost = website ? new URL(website).hostname.toLowerCase().replace(/^www\./, "") : null;
  } catch {}
  const match =
    !freemail &&
    Boolean(siteHost) &&
    (siteHost === emailDomain || siteHost!.endsWith(`.${emailDomain}`) || emailDomain.endsWith(`.${siteHost}`));
  return { emailDomain, siteHost, match, freemail };
}
