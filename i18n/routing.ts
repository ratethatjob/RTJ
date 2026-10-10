import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "hu"],
  defaultLocale: "en",
  // English at the root, other languages under a prefix: /hu/...
  localePrefix: "as-needed",
});
