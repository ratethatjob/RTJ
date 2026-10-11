import { getTranslations } from "next-intl/server";
import type { AreaPickerLabels } from "@/components/home/area-picker";
import { SEARCH_AREAS } from "./search-areas";

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
