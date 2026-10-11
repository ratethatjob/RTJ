import { getTranslations } from "next-intl/server";
import type { AreaPickerLabels } from "@/components/home/area-picker";
import { SEARCH_AREAS } from "./search-areas";
import { visitorArea } from "./visitor-area";

/** Picker labels from the server, so pages outside /app don't need the "Places" messages on the client. */
export async function areaPickerLabels(): Promise<AreaPickerLabels> {
  const t = await getTranslations("Places");
  return {
    label: t("areaLabel"),
    auto: t("areaAuto"),
    here: t("areaHere"),
    any: t("areaAny"),
    hereError: t("areaHereError"),
    areas: Object.fromEntries(Object.keys(SEARCH_AREAS).map((id) => [id, t(`areas.${id}`)])),
  };
}

/** The city "Automatic" searches around for this visitor (cookie, IP, time zone, language); null = everywhere. */
export async function autoAreaName(locale: string): Promise<string | null> {
  const area = await visitorArea(locale);
  if (area.kind === "any") return null;
  if (area.kind === "city") return area.city;
  const t = await getTranslations("Places");
  return t(`areas.${area.id}`);
}
