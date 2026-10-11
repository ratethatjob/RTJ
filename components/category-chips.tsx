import type { ComponentProps, ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CATEGORIES, MAIN_CATEGORIES, type Category } from "@/lib/categories";

type Href = ComponentProps<typeof Link>["href"];

/** Category filter chips in one row that scrolls sideways: the main categories (and the active
 *  one) first, then the rest A–Z. */
export async function CategoryChips({
  active,
  href,
  lead,
}: {
  active: Category | null;
  href: (category: Category) => Href;
  /** Chips before the categories ("All", "Quick apply"), as <li> elements. */
  lead?: ReactNode;
}) {
  const tc = await getTranslations("Categories");
  const main = CATEGORIES.filter((c) => MAIN_CATEGORIES.includes(c) || c === active);
  const rest = CATEGORIES.filter((c) => !main.includes(c)).sort((a, b) =>
    tc(`${a}Plural`).localeCompare(tc(`${b}Plural`)),
  );
  const chip = (c: Category) => (
    <li key={c} className="shrink-0">
      <Link
        href={href(c)}
        aria-current={c === active ? "page" : undefined}
        className={`inline-block whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold ${
          c === active ? "bg-ink text-paper" : "border border-mist/60"
        }`}
      >
        {tc(`${c}Plural`)}
      </Link>
    </li>
  );

  return (
    <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {lead}
      {main.map(chip)}
      {rest.map(chip)}
    </ul>
  );
}
