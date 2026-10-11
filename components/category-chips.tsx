import type { ComponentProps, ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CATEGORIES, MAIN_CATEGORIES, type Category } from "@/lib/categories";

type Href = ComponentProps<typeof Link>["href"];

/** Category filter chips: the main categories (and the active one) in a row, the rest under "More". */
export async function CategoryChips({
  active,
  href,
  lead,
  wrap = false,
}: {
  active: Category | null;
  href: (category: Category) => Href;
  /** Chips before the categories ("All", "Quick apply"), as <li> elements. */
  lead?: ReactNode;
  /** Wrap onto more lines instead of scrolling sideways. */
  wrap?: boolean;
}) {
  const tc = await getTranslations("Categories");
  const main = CATEGORIES.filter((c) => MAIN_CATEGORIES.includes(c) || c === active);
  const rest = CATEGORIES.filter((c) => !main.includes(c));
  const chip = (c: Category) => (
    <li key={c} className="shrink-0">
      <Link
        href={href(c)}
        aria-current={c === active ? "page" : undefined}
        className={`inline-block rounded-full px-5 py-2.5 font-black ${
          c === active ? "bg-ink text-paper" : "border border-mist/60"
        }`}
      >
        {tc(`${c}Plural`)}
      </Link>
    </li>
  );

  return (
    <div className="flex flex-col gap-3">
      <ul className={wrap ? "flex flex-wrap gap-2" : "-mx-4 flex gap-2 overflow-x-auto px-4"}>
        {lead}
        {main.map(chip)}
      </ul>
      <details className="group">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-mist/60 px-5 py-2.5 font-black [&::-webkit-details-marker]:hidden">
          {tc("more")}
          <svg
            viewBox="0 0 24 24"
            className="size-4 transition group-open:rotate-180"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <ul className="mt-3 flex flex-wrap gap-2">{rest.map(chip)}</ul>
      </details>
    </div>
  );
}
