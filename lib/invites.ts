// Shared by the invite form (client) and the server action.

export const MAX_INVITES = 200;

const EMAIL = /[^\s@<>(),;:"']+@[^\s@<>(),;:"']+\.[a-z]{2,}/i;
const LANG: Record<string, "en" | "hu"> = {
  en: "en", eng: "en", english: "en", angol: "en",
  hu: "hu", hun: "hu", hungarian: "hu", magyar: "hu",
};

/** Emails from pasted text or a CSV: one per line or separated by commas, semicolons or tabs.
 *  A cell with a language (en/hu, English/Hungarian, angol/magyar) on the same line sets it. */
export function parseInviteText(text: string): { email: string; locale?: "en" | "hu" }[] {
  const out = new Map<string, "en" | "hu" | undefined>();
  for (const line of text.split(/\r?\n/)) {
    const cells = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    const locale = cells.map((c) => LANG[c.toLowerCase()]).find(Boolean);
    for (const cell of cells.length > 1 ? cells : line.split(/\s+/)) {
      const m = cell.match(EMAIL);
      if (m) {
        const email = m[0].toLowerCase();
        if (!out.has(email) || locale) out.set(email, locale);
      }
    }
  }
  return [...out].map(([email, locale]) => ({ email, ...(locale && { locale }) }));
}
