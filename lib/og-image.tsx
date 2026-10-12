import { ImageResponse } from "next/og";
import { getFormatter, getTranslations } from "next-intl/server";
import type { LocationSummary } from "@/lib/data/types";
import { archivoFonts, OG_FONT_FAMILY } from "@/lib/og-fonts";

// Branded 1200×630 share images, served by app/api/og/route.tsx.

export const OG_SIZE = { width: 1200, height: 630 };
export const INK = "#14161A";
export const PAPER = "#F4F2EE";
export const SIGNAL = "#3DDC97";
export const MIST = "#B5BAC1";
const CACHE = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";

/** Green speech bubble with the check mark + "RateThatJob.com". */
export function OgBrand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <svg width="52" height="50" viewBox="0 0 100 95">
        <path
          d="M10 0h80a10 10 0 0 1 10 10v55a10 10 0 0 1-10 10H50L25 95V75H10A10 10 0 0 1 0 65V10A10 10 0 0 1 10 0Z"
          fill={SIGNAL}
        />
        <path d="M28 39l14 14 30-30" fill="none" stroke={INK} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: "flex", fontSize: 36, letterSpacing: "-0.03em" }}>
        <span style={{ fontWeight: 900 }}>RateThatJob</span>
        <span style={{ fontWeight: 500, color: MIST }}>.com</span>
      </div>
    </div>
  );
}

/** Green score tile: "4.3 / out of 5". */
export function OgScore({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: 230,
        height: 230,
        flexShrink: 0,
        borderRadius: 40,
        background: SIGNAL,
        color: INK,
      }}
    >
      <div style={{ fontSize: 104, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 26, fontWeight: 500 }}>{label}</div>
      {note && <div style={{ marginTop: 4, fontSize: 20, fontWeight: 500 }}>{note}</div>}
    </div>
  );
}

function titleSize(text: string) {
  if (text.length > 70) return 54;
  if (text.length > 40) return 66;
  return 84;
}

export async function ogResponse({
  eyebrow,
  title,
  sub,
  score,
  cta,
  tagline,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  score?: { value: string; label: string; note?: string };
  /** Green line under the title ("Be the first to rate"). */
  cta?: string;
  /** Small caps line at the bottom (left out on the home image, whose title is the tagline). */
  tagline?: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: INK,
          color: PAPER,
          padding: 72,
          fontFamily: OG_FONT_FAMILY,
        }}
      >
        <OgBrand />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: score ? 760 : 1056 }}>
            {eyebrow && (
              <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "0.12em", color: SIGNAL, marginBottom: 18 }}>
                {eyebrow.toUpperCase()}
              </div>
            )}
            <div style={{ fontSize: titleSize(title), fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.04 }}>
              {title}
            </div>
            {sub && <div style={{ marginTop: 22, fontSize: 34, fontWeight: 500, color: MIST, lineHeight: 1.25 }}>{sub}</div>}
            {cta && <div style={{ marginTop: 26, fontSize: 40, fontWeight: 900, color: SIGNAL }}>{cta}</div>}
          </div>
          {score && <OgScore {...score} />}
        </div>
        <div style={{ display: "flex", height: 26, fontSize: 22, fontWeight: 500, letterSpacing: "0.16em", color: MIST }}>
          {tagline?.toUpperCase() ?? ""}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: await archivoFonts(),
      headers: { "Cache-Control": CACHE },
    },
  );
}

/** Location page image: name, address, score tile and two fact bars (or "Be the first to rate"). */
export async function locationOgResponse(locale: string, data: LocationSummary | null) {
  const t = await getTranslations({ locale, namespace: "Location" });
  const tm = await getTranslations({ locale, namespace: "Metadata" });
  const to = await getTranslations({ locale, namespace: "Og" });
  const format = await getFormatter({ locale });
  const s = data?.scores;
  const facts = s
    ? ([
        [t("facts.paid_on_time"), s.facts.paid_on_time],
        [t("repliesToApplicants"), s.replyRate],
      ] as const).filter(([, v]) => v != null)
    : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: INK,
          color: PAPER,
          padding: 72,
          fontFamily: OG_FONT_FAMILY,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
            <div style={{ fontSize: 76, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {data?.name ?? "RateThatJob"}
            </div>
            {data && (
              <div style={{ marginTop: 18, fontSize: 34, fontWeight: 500, color: MIST }}>
                {`${data.address}, ${data.city}`}
              </div>
            )}
          </div>
          {s && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: 220,
                height: 220,
                borderRadius: 40,
                background: SIGNAL,
                color: INK,
              }}
            >
              <div style={{ fontSize: 104, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>
                {format.number(s.overall, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </div>
              <div style={{ fontSize: 26, fontWeight: 500 }}>{t("outOf5")}</div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          {facts.map(([label, value]) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 32, fontWeight: 900 }}>
                <span>{label}</span>
                <span>{`${value}%`}</span>
              </div>
              <div style={{ display: "flex", height: 14, borderRadius: 7, background: "#2A2D33" }}>
                <div style={{ width: `${value}%`, borderRadius: 7, background: SIGNAL }} />
              </div>
            </div>
          ))}
          {!s && data && (
            <div style={{ fontSize: 40, fontWeight: 900, color: SIGNAL }}>{to("beFirst")}</div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            <OgBrand />
            <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "0.16em", color: MIST }}>
              {tm("tagline").toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: await archivoFonts(),
      headers: { "Cache-Control": CACHE },
    },
  );
}
