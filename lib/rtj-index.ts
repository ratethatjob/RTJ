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

export async function getIndexLocation(id: string) {
  const location = await getLocationById(id);
  if (!location) return null;
  return {
    location,
    showScore: (location.scores?.reviewCount ?? 0) >= MIN_REVIEWS,
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

export function renderSeal(data: NonNullable<Awaited<ReturnType<typeof getIndexLocation>>>, l: BadgeLabels) {
  const size = 168;
  const c = size / 2;
  return svg(
    size,
    size,
    `${l.topRated} ${l.year} – ${data.location.name}`,
    `<circle cx="${c}" cy="${c}" r="${c - 2}" fill="${INK}"/>` +
      `<circle cx="${c}" cy="${c}" r="${c - 10}" fill="none" stroke="${SIGNAL}" stroke-width="2"/>` +
      icon(c - 18, 26, 34) +
      `<text x="${c}" y="82" font-size="9.5" font-weight="800" letter-spacing="1" text-anchor="middle" fill="${MIST}">${esc(l.topRated.toUpperCase())}</text>` +
      `<text x="${c}" y="118" font-size="34" font-weight="900" letter-spacing="-1" text-anchor="middle" fill="${SIGNAL}">${esc(l.year)}</text>` +
      `<text x="${c}" y="140" font-size="13" font-weight="900" text-anchor="middle" fill="${PAPER}">RateThatJob</text>`,
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
    score,
    year: String(new Date().getFullYear()),
  };
}

/** Public, cacheable, open to every origin. */
export const PUBLIC_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400",
};
