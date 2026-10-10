import { getTranslations } from "next-intl/server";

/** GET form that switches the ?location= filter; works without JavaScript. */
export async function LocationSelect({
  locations,
  selected,
  allowAll = true,
  extra = {},
}: {
  locations: { id: string; address: string }[];
  selected: string | null;
  allowAll?: boolean;
  extra?: Record<string, string>;
}) {
  const t = await getTranslations("Business");
  return (
    <form className="flex items-center gap-2">
      {Object.entries(extra).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label htmlFor="location" className="font-black">
        {t("location")}
      </label>
      <select
        id="location"
        name="location"
        defaultValue={selected ?? ""}
        className="rounded-lg border border-mist/60 bg-white px-3 py-2 font-black"
      >
        {allowAll && <option value="">{t("allLocations")}</option>}
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.address}
          </option>
        ))}
      </select>
      <button className="rounded-lg border border-ink px-3 py-2 text-sm font-black">OK</button>
    </form>
  );
}
