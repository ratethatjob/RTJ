import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  cacheComponents: true,
  async redirects() {
    // The careers page widget became "RateThatJob Careers Hub".
    return [
      { source: "/career-page", destination: "/careers-hub", statusCode: 301 },
      { source: "/en/career-page", destination: "/careers-hub", statusCode: 301 },
      { source: "/hu/career-page", destination: "/hu/careers-hub", statusCode: 301 },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
