import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { LocationSummary } from "@/lib/data/types";
import { locationPath } from "@/lib/format";
import { formatScore } from "./scores";

/** Workplace rows with score tile, used by search and city hubs. */
export async function LocationList({ locations }: { locations: LocationSummary[] }) {
  const tc = await getTranslations("Categories");
  const tl = await getTranslations("Company");

  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {await Promise.all(
        locations.map(async (l) => (
          <li key={l.id}>
            <Link
              href={locationPath(l)}
              className="flex h-full items-center justify-between gap-4 rounded-3xl bg-white p-5 sm:p-6"
            >
              <span className="min-w-0">
                <span className="block text-2xl font-black tracking-brand">{l.name}</span>
                <span className="text-slate">
                  {l.address}, {l.city} · {tc(l.category)}
                </span>
              </span>
              {l.scores ? (
                <span
                  className={`grid size-16 shrink-0 place-items-center rounded-2xl text-2xl font-black ${
                    l.scores.overall >= 4 ? "bg-signal" : "bg-[#E8E6E1]"
                  }`}
                >
                  {await formatScore(l.scores.overall)}
                </span>
              ) : (
                <span className="shrink-0 text-sm text-slate">{tl("noScore")}</span>
              )}
            </Link>
          </li>
        )),
      )}
    </ul>
  );
}
