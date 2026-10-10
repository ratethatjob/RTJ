import { getTranslations } from "next-intl/server";
import { ChevronLeftIcon } from "@/components/icons";

/** Plain anchor so it can point at a full (already localized) path. */
export async function BackLink({ href }: { href: string }) {
  const t = await getTranslations("Nav");
  return (
    <a href={href} aria-label={t("back")} className="-ml-2 inline-block p-2">
      <ChevronLeftIcon className="size-7" />
    </a>
  );
}
