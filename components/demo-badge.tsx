import { getTranslations } from "next-intl/server";

/** Marks made-up demo data so nobody takes it for real reviews. */
export async function DemoBanner() {
  const t = await getTranslations("Demo");
  return (
    <div role="note" className="mb-4 rounded-2xl border-2 border-dashed border-ink bg-white px-4 py-3">
      <span className="mr-2 rounded-md bg-ink px-2 py-0.5 text-sm font-black uppercase tracking-tagline text-paper">
        {t("label")}
      </span>
      <span className="font-black">{t("banner")}</span>
    </div>
  );
}

/** Small "Demo data" chip for cards. */
export async function DemoChip() {
  const t = await getTranslations("Demo");
  return (
    <span className="inline-block rounded-md border-2 border-dashed border-ink px-2 py-0.5 text-xs font-black uppercase tracking-tagline">
      {t("label")}
    </span>
  );
}
