import { ImageResponse } from "next/og";
import { getFormatter, getTranslations } from "next-intl/server";
import { getLocation } from "@/lib/data";
import { archivoFonts } from "@/lib/og-fonts";

export const alt = "RateThatJob";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#14161A";
const PAPER = "#F4F2EE";
const SIGNAL = "#3DDC97";
const MIST = "#B5BAC1";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; company: string; location: string }>;
}) {
  const { locale, company, location } = await params;
  const data = await getLocation(company, location);
  const t = await getTranslations({ locale, namespace: "Location" });
  const tm = await getTranslations({ locale, namespace: "Metadata" });
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
          fontFamily: "Archivo",
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
            <div style={{ fontSize: 40, fontWeight: 900, color: SIGNAL }}>{t("beTheFirst")}</div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
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
            <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "0.16em", color: MIST }}>
              {tm("tagline").toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await archivoFonts() },
  );
}
