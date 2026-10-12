import { getLocationById } from "@/lib/data";
import type { LocationSummary } from "@/lib/data/types";
import { locationPath } from "@/lib/format";
import { SITE_URL } from "@/lib/seo";

// RateThatJob Index: data and SVG badges shared by /embed, widget.js and the JSON API.

export const BADGE_STYLES = ["compact-light", "compact-dark", "wide-light", "wide-dark", "strip"] as const;
export type BadgeStyle = (typeof BADGE_STYLES)[number];

/** The score is shown from this many published reviews. */
export const MIN_REVIEWS = 5;

export function isTopRated(l: LocationSummary) {
  // location_scores is a rolling 12-month window.
  return Boolean(l.scores && l.scores.overall >= 4 && l.scores.verifiedCount >= 10);
}

/** Embeds show the Index only while the location has Pro (trial or paid). */
export const indexActive = (l: LocationSummary) => l.indexActive !== false;

export async function getIndexLocation(id: string) {
  const location = await getLocationById(id);
  if (!location) return null;
  const active = indexActive(location);
  return {
    location,
    active,
    showScore: active && (location.scores?.reviewCount ?? 0) >= MIN_REVIEWS,
    profileUrl: `${SITE_URL}${locationPath(location)}`,
    rateUrl: `${SITE_URL}/app/rate/${location.id}`,
  };
}

export type BadgeLabels = {
  name: string;
  verified: string;
  rateUs: string;
  workedHere: string;
  strip: string;
  paidOnTime: string;
  replies: string;
  topRated: string;
  footer: string;
  unavailable: string;
  unavailableHint: string;
  score: string;
  year: string;
};

const INK = "#14161A";
const PAPER = "#F4F2EE";
const SIGNAL = "#3DDC97";
const SLATE = "#4A4F57";
const MIST = "#B5BAC1";
const FONT = "Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Rough text width so badges can size themselves without font metrics. */
const textWidth = (s: string, size: number, bold = false) => s.length * size * (bold ? 0.56 : 0.5);

const icon = (x: number, y: number, h: number) => {
  const k = h / 95;
  return `<g transform="translate(${x} ${y}) scale(${k})"><path d="M10 0h80a10 10 0 0 1 10 10v55a10 10 0 0 1-10 10H50L25 95V75H10A10 10 0 0 1 0 65V10A10 10 0 0 1 10 0Z" fill="${SIGNAL}"/><path d="M28 39l14 14 30-30" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/></g>`;
};

const svg = (w: number, h: number, title: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w)}" height="${h}" viewBox="0 0 ${Math.ceil(w)} ${h}" role="img" aria-label="${esc(title)}" font-family="${FONT}"><title>${esc(title)}</title>${body}</svg>`;

export function renderBadge(
  style: BadgeStyle,
  data: NonNullable<Awaited<ReturnType<typeof getIndexLocation>>>,
  l: BadgeLabels,
): string {
  const { location, showScore } = data;
  const s = location.scores;
  const dark = style.endsWith("dark");
  const bg = dark ? INK : "#FFFFFF";
  const fg = dark ? PAPER : INK;
  const sub = dark ? MIST : SLATE;
  const border = dark ? "" : ` stroke="#E3E1DC"`;
  const title = showScore ? `${location.name}: ${l.score} – ${l.name}` : l.rateUs;

  if (!data.active) return renderUnavailable(style, location.name, l);

  if (style === "strip") {
    const text = showScore ? l.strip : l.rateUs;
    const w = 44 + textWidth(text, 15, true);
    return svg(
      w,
      32,
      title,
      `<rect x=".5" y=".5" width="${Math.ceil(w) - 1}" height="31" rx="8" fill="#FFFFFF" stroke="#E3E1DC"/>${icon(10, 7, 18)}<text x="36" y="21" font-size="15" font-weight="700" fill="${INK}">${esc(text)}</text>`,
    );
  }

  if (style.startsWith("compact")) {
    const line1 = showScore ? l.name : l.rateUs;
    const line2 = showScore ? l.verified : l.workedHere;
    const scoreW = showScore ? textWidth(l.score, 34, true) + 14 : 0;
    const w = 64 + scoreW + Math.max(textWidth(line1, 15, true), textWidth(line2, 13)) + 18;
    return svg(
      w,
      64,
      title,
      `<rect x=".5" y=".5" width="${Math.ceil(w) - 1}" height="63" rx="14" fill="${bg}"${border}/>${icon(16, 17, 30)}` +
        (showScore
          ? `<text x="62" y="44" font-size="34" font-weight="900" letter-spacing="-1" fill="${fg}">${esc(l.score)}</text>`
          : "") +
        `<text x="${62 + scoreW}" y="29" font-size="15" font-weight="800" fill="${fg}">${esc(line1)}</text>` +
        `<text x="${62 + scoreW}" y="47" font-size="13" fill="${sub}">${esc(line2)}</text>`,
    );
  }

  // Wide card
  const w = 400;
  const h = 216;
  let body = `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="20" fill="${bg}"${border}/>`;
  const name = location.name.length > 26 ? `${location.name.slice(0, 25)}…` : location.name;
  if (showScore && s) {
    body +=
      `<rect x="20" y="20" width="72" height="72" rx="16" fill="${SIGNAL}"/>` +
      `<text x="56" y="67" font-size="30" font-weight="900" text-anchor="middle" letter-spacing="-1" fill="${INK}">${esc(l.score)}</text>` +
      `<text x="108" y="48" font-size="20" font-weight="900" letter-spacing="-.5" fill="${fg}">${esc(name)}</text>` +
      `<text x="108" y="72" font-size="14" fill="${sub}">${esc(l.name)} · ${esc(l.verified)}</text>`;
    const facts = [
      [l.paidOnTime, s.facts.paid_on_time],
      [l.replies, s.replyRate],
    ] as const;
    facts.forEach(([label, value], i) => {
      const y = 118 + i * 36;
      const pct = value ?? 0;
      body +=
        `<text x="20" y="${y}" font-size="14" font-weight="700" fill="${fg}">${esc(label)}</text>` +
        `<text x="${w - 20}" y="${y}" font-size="14" font-weight="700" text-anchor="end" fill="${fg}">${value == null ? "–" : `${pct}%`}</text>` +
        `<rect x="20" y="${y + 8}" width="${w - 40}" height="8" rx="4" fill="${dark ? "#2A2D33" : "#E8E6E1"}"/>` +
        (pct > 0 ? `<rect x="20" y="${y + 8}" width="${((w - 40) * pct) / 100}" height="8" rx="4" fill="${SIGNAL}"/>` : "");
    });
  } else {
    body +=
      `${icon(20, 22, 40)}` +
      `<text x="76" y="40" font-size="20" font-weight="900" letter-spacing="-.5" fill="${fg}">${esc(name)}</text>` +
      `<text x="76" y="62" font-size="14" fill="${sub}">${esc(l.name)}</text>` +
      `<text x="20" y="118" font-size="22" font-weight="900" letter-spacing="-.5" fill="${fg}">${esc(l.rateUs)}</text>` +
      `<text x="20" y="144" font-size="15" fill="${sub}">${esc(l.workedHere)}</text>`;
  }
  body += `<text x="20" y="${h - 18}" font-size="12" fill="${sub}">${esc(l.footer)}</text>`;
  return svg(w, h, title, body);
}

/** Shown instead of the score when the location's Pro (trial or paid) has ended. */
function renderUnavailable(style: BadgeStyle, name: string, l: BadgeLabels): string {
  const dark = style.endsWith("dark");
  const bg = dark ? INK : "#FFFFFF";
  const fg = dark ? PAPER : INK;
  const sub = dark ? MIST : SLATE;
  const border = dark ? "" : ` stroke="#E3E1DC"`;
  const title = `${name}: ${l.unavailable} ${l.unavailableHint}`;
  if (style === "strip") {
    const text = `${l.unavailable} ${l.unavailableHint}`;
    const w = 44 + textWidth(text, 13, true);
    return svg(
      w,
      32,
      title,
      `<rect x=".5" y=".5" width="${Math.ceil(w) - 1}" height="31" rx="8" fill="#FFFFFF" stroke="#E3E1DC"/>${icon(10, 7, 18)}<text x="36" y="20" font-size="13" font-weight="700" fill="${INK}">${esc(text)}</text>`,
    );
  }
  const compact = style.startsWith("compact");
  const w = compact
    ? 64 + Math.max(textWidth(l.unavailable, 15, true), textWidth(l.unavailableHint, 13)) + 18
    : 400;
  if (compact) {
    return svg(
      w,
      64,
      title,
      `<rect x=".5" y=".5" width="${Math.ceil(w) - 1}" height="63" rx="14" fill="${bg}"${border}/>${icon(16, 17, 30)}` +
        `<text x="62" y="29" font-size="15" font-weight="800" fill="${fg}">${esc(l.unavailable)}</text>` +
        `<text x="62" y="47" font-size="13" fill="${sub}">${esc(l.unavailableHint)}</text>`,
    );
  }
  const h = 216;
  const short = name.length > 26 ? `${name.slice(0, 25)}…` : name;
  return svg(
    w,
    h,
    title,
    `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="20" fill="${bg}"${border}/>` +
      `${icon(20, 22, 40)}` +
      `<text x="76" y="40" font-size="20" font-weight="900" letter-spacing="-.5" fill="${fg}">${esc(short)}</text>` +
      `<text x="76" y="62" font-size="14" fill="${sub}">${esc(l.name)}</text>` +
      wrap(l.unavailable, 30)
        .map((line, i) => `<text x="20" y="${112 + i * 26}" font-size="20" font-weight="900" fill="${fg}">${esc(line)}</text>`)
        .join("") +
      wrap(l.unavailableHint, 44)
        .map((line, i) => `<text x="20" y="${166 + i * 19}" font-size="14" fill="${sub}">${esc(line)}</text>`)
        .join(""),
  );
}

/** Splits text into lines of at most `max` characters, on spaces. */
function wrap(text: string, max: number) {
  const lines: string[] = [];
  for (const word of text.split(" ")) {
    const last = lines[lines.length - 1];
    if (last && `${last} ${word}`.length <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/** Top Rated Employer seal: a rounded square, dark or light. Without Pro it says the Index is unavailable. */
export function renderSeal(
  data: NonNullable<Awaited<ReturnType<typeof getIndexLocation>>>,
  l: BadgeLabels,
  theme: "dark" | "light" = "dark",
) {
  const size = 168;
  const c = size / 2;
  const dark = theme === "dark";
  const bg = dark ? INK : "#FFFFFF";
  const fg = dark ? PAPER : INK;
  const sub = dark ? MIST : SLATE;
  const frame =
    `<rect x="1" y="1" width="${size - 2}" height="${size - 2}" rx="26" fill="${bg}"${dark ? "" : ` stroke="#E3E1DC" stroke-width="2"`}/>` +
    `<rect x="9" y="9" width="${size - 18}" height="${size - 18}" rx="19" fill="none" stroke="${SIGNAL}" stroke-width="2"/>`;
  if (!data.active) {
    return svg(
      size,
      size,
      `${data.location.name}: ${l.unavailable} ${l.unavailableHint}`,
      frame +
        icon(c - 14, 22, 26) +
        wrap(l.unavailable, 20)
          .map((line, i) => `<text x="${c}" y="${72 + i * 14}" font-size="11" font-weight="800" text-anchor="middle" fill="${fg}">${esc(line)}</text>`)
          .join("") +
        wrap(l.unavailableHint, 26)
          .map((line, i) => `<text x="${c}" y="${116 + i * 12}" font-size="9" text-anchor="middle" fill="${sub}">${esc(line)}</text>`)
          .join(""),
    );
  }
  const label = wrap(l.topRated.toUpperCase(), 12);
  return svg(
    size,
    size,
    `${l.topRated} ${l.year} – ${data.location.name}`,
    frame +
      icon(c - 15, 22, 28) +
      label
        .map((line, i) => `<text x="${c}" y="${70 + i * 13}" font-size="10.5" font-weight="800" letter-spacing="1.2" text-anchor="middle" fill="${sub}">${esc(line)}</text>`)
        .join("") +
      // Green text only on dark; on light the year is ink with a green bar.
      `<text x="${c}" y="${120 + (label.length - 2) * 6}" font-size="34" font-weight="900" letter-spacing="-1" text-anchor="middle" fill="${dark ? SIGNAL : INK}">${esc(l.year)}</text>` +
      (dark ? "" : `<rect x="${c - 22}" y="${127 + (label.length - 2) * 6}" width="44" height="4" rx="2" fill="${SIGNAL}"/>`) +
      `<text x="${c}" y="147" font-size="13" font-weight="900" text-anchor="middle" fill="${fg}">RateThatJob</text>`,
  );
}

export async function badgeLabels(
  locale: string,
  data: NonNullable<Awaited<ReturnType<typeof getIndexLocation>>>,
): Promise<BadgeLabels> {
  const { getTranslations } = await import("next-intl/server");
  const t = await getTranslations({ locale, namespace: "Index.badge" });
  const s = data.location.scores;
  const num = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const score = s ? num.format(s.overall) : "";
  const strip = s
    ? [
        t("stripScore", { score }),
        s.facts.paid_on_time != null && t("stripPaid", { pct: s.facts.paid_on_time }),
        s.replyRate != null && t("stripReplies", { pct: s.replyRate }),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  return {
    name: t("name"),
    verified: t("verified", { count: s?.verifiedCount ?? 0 }),
    rateUs: t("rateUs"),
    workedHere: t("workedHere"),
    strip,
    paidOnTime: t("paidOnTime"),
    replies: t("replies"),
    topRated: t("topRated"),
    footer: t("footer"),
    unavailable: t("unavailable"),
    unavailableHint: t("unavailableHint"),
    score,
    year: String(new Date().getFullYear()),
  };
}

/** Our page URL in the embed's language (English at the root, others under /<locale>). */
export const localeUrl = (url: string, locale: string) =>
  locale === "en" || !url.startsWith(SITE_URL) ? url : `${SITE_URL}/${locale}${url.slice(SITE_URL.length)}`;

/** Public, cacheable, open to every origin. */
export const PUBLIC_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400",
};

/** Badges are only cached in the browser so every embedding site is counted. */
export const EMBED_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=600",
};

/** Records which website shows the badge (domain only, nothing about the visitor). */
export async function recordEmbed(request: Request, locationId: string) {
  const source = request.headers.get("referer") ?? request.headers.get("origin");
  if (!source) return;
  let domain: string;
  try {
    domain = new URL(source).hostname.replace(/^www\./, "");
  } catch {
    return;
  }
  const own = new URL(request.url).hostname;
  if (!domain || domain === own || domain === "localhost" || domain.endsWith("ratethatjob.com")) return;
  // Service role only: nobody can add domains to an employer's list through the public API.
  const { adminClient } = await import("@/lib/supabase/admin");
  await adminClient()?.rpc("record_embed_view", { p_location_id: locationId, p_domain: domain });
}
