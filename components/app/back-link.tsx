import { getTranslations } from "next-intl/server";
import { BACK_LINK_CLASS } from "@/components/app/back-link-class";
import { ChevronLeftIcon } from "@/components/icons";

/** "← Back" to the parent page. Plain anchor so it can point at a full (already localized) path. */
export async function BackLink({ href, label }: { href: string; label?: string }) {
  const t = await getTranslations("Nav");
  return (
    <a href={href} className={BACK_LINK_CLASS}>
      <ChevronLeftIcon className="size-6" />
      {label ?? t("back")}
    </a>
  );
}
