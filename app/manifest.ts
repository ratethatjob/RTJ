import type { MetadataRoute } from "next";

// /manifest.webmanifest (linked from every page by Next.js). Icons made from app/icon.png.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RateThatJob – Know before you go",
    short_name: "RateThatJob",
    description: "Workplace reviews from people who worked or applied there: pay, hours, managers.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: "#14161A",
    background_color: "#F4F2EE",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
