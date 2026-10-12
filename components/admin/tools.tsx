"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  backfillPlaceTypes,
  bulkSetCategory,
  type ImportRow,
  importLocations,
  linkEntity,
  refreshPublicPages,
  setLocationCategory,
  setSlug,
  unverifyEntity,
} from "@/app/[locale]/admin/actions";
import { CategorySelect } from "@/components/category-select";

/** After a migration or SQL change: every public workplace and job page is rendered fresh. */
export function RefreshPages() {
  const t = useTranslations("Admin");
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-white p-5">
      <p className="min-w-0 flex-1 text-sm text-slate">{t("refreshPagesHint")}</p>
      <button
        type="button"
        disabled={pending} aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await refreshPublicPages();
            setState(result.error ? "error" : "done");
          })
        }
        className="rounded-xl bg-ink px-4 py-2 text-sm font-black text-paper disabled:opacity-40"
      >
        {t("refreshPages")}
      </button>
      {state !== "idle" && (
        <span role="status" className="text-sm font-black">
          {t(state === "done" ? "refreshPagesDone" : "refreshPagesError")}
        </span>
      )}
    </div>
  );
}

/** Admin override of a workplace's category; saved on change. */
export function CategoryEditor({ id, category }: { id: string; category: string }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [value, setValue] = useState(category);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <CategorySelect
        auto={false}
        value={value}
        onChange={(next) => {
          setValue(next);
          startTransition(async () => {
            setError(false);
            const result = await setLocationCategory(id, next);
            if (result.error) return setError(true);
            router.refresh();
          });
        }}
        className={`rounded-xl border border-mist/60 bg-white px-3 py-2 text-sm outline-none focus:border-ink ${pending ? "opacity-60" : ""}`}
      />
      {error && <span className="text-sm font-black">{t("categoryError")}</span>}
    </div>
  );
}

export function SlugEditor({
  kind,
  id,
  slug,
  prefix,
}: {
  kind: "company" | "location";
  id: string;
  slug: string;
  prefix: string;
}) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [value, setValue] = useState(slug);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="font-mono text-sm text-slate">{prefix}</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value.toLowerCase())}
        className="min-w-0 flex-1 rounded-xl border border-mist/60 px-3 py-2 font-mono text-sm outline-none focus:border-ink"
      />
      <button
        type="button"
        disabled={pending || value === slug} aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            setError(false);
            const result = await setSlug(kind, id, value);
            if (result.error) return setError(true);
            router.refresh();
          })
        }
        className="rounded-xl bg-ink px-4 py-2 text-sm font-black text-paper disabled:opacity-40"
      >
        {t("saveSlug")}
      </button>
      {error && <span className="text-sm font-black">{t("slugError")}</span>}
    </div>
  );
}

const COLUMNS = ["company", "name", "address", "city", "country", "category", "lat", "lng", "google_place_id"];

/** Minimal RFC 4180 parser: commas or semicolons, quoted fields. */
function parseCsv(text: string): string[][] {
  const delimiter = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

export function CsvImport() {
  const t = useTranslations("Admin");
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ created: number; skipped: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed: { error: true } | { rows: ImportRow[] } | null = (() => {
    if (!text.trim()) return null;
    const [header, ...body] = parseCsv(text);
    const keys = header.map((h) => h.trim().toLowerCase());
    if (!["company", "address", "city", "country", "category"].every((k) => keys.includes(k))) {
      return { error: true as const };
    }
    const rows: ImportRow[] = body.map((cells) =>
      Object.fromEntries(keys.filter((k) => COLUMNS.includes(k)).map((k) => [k, (cells[keys.indexOf(k)] ?? "").trim()])),
    );
    return { rows };
  })();
  const rows = parsed && "rows" in parsed ? parsed.rows : null;

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-white p-5">
      <h2 className="text-2xl font-black tracking-brand">{t("importTitle")}</h2>
      <p className="text-slate">{t("importBody")}</p>
      <code className="block overflow-x-auto rounded-xl bg-paper p-3 text-sm">{COLUMNS.join(",")}</code>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) setText(await file.text());
        }}
        className="text-sm"
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={t("importPlaceholder")}
        className="w-full rounded-2xl border border-mist/60 px-4 py-3 font-mono text-sm outline-none focus:border-ink"
      />
      {parsed && "error" in parsed && <p className="font-black">{t("importHeaderError")}</p>}
      {rows && <p className="font-black">{t("importRows", { count: rows.length })}</p>}
      {error && <p className="font-black">{error}</p>}
      {result && <p className="rounded-2xl bg-paper p-4 font-black">{t("importResult", result)}</p>}
      <button
        type="button"
        disabled={pending || !rows?.length} aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            if (!rows) return;
            setError(null);
            const total = { created: 0, skipped: 0, failed: 0 };
            for (let i = 0; i < rows.length; i += 500) {
              const r = await importLocations(rows.slice(i, i + 500));
              if ("error" in r) return setError(t("error"));
              total.created += r.created;
              total.skipped += r.skipped;
              total.failed += r.failed;
              setResult({ ...total });
            }
          })
        }
        className="self-start rounded-2xl bg-ink px-6 py-3 font-black text-paper disabled:opacity-40"
      >
        {t("importButton")}
      </button>
    </section>
  );
}

export function EntityForm({ locationId, country }: { locationId: string; country: string }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [name, setName] = useState("");
  const [registry, setRegistry] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const input = "min-w-0 rounded-xl border border-mist/60 px-3 py-2 outline-none focus:border-ink";
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("entityName")} className={`${input} flex-1`} />
      <input value={registry} onChange={(e) => setRegistry(e.target.value)} placeholder={t("entityRegistry")} className={`${input} w-40`} />
      <button
        type="button"
        disabled={pending || name.trim().length < 2} aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            setError(false);
            const result = await linkEntity(locationId, name, country, registry);
            if (result.error) return setError(true);
            setName("");
            setRegistry("");
            router.refresh();
          })
        }
        className="rounded-xl bg-ink px-4 py-2 font-black text-paper disabled:opacity-40"
      >
        {t("entityLink")}
      </button>
      {error && <span className="text-sm font-black">{t("error")}</span>}
    </div>
  );
}

export function UnverifyEntity({ linkId }: { linkId: string }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending} aria-busy={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await unverifyEntity(linkId);
          if (!result.error) router.refresh();
        })
      }
      className="text-sm font-black underline underline-offset-4"
    >
      {t("entityUnlink")}
    </button>
  );
}

/** Fills exact place types from map data, 40 workplaces per click (Google details calls). */
export function BackfillPlaceTypes() {
  const t = useTranslations("Admin");
  const [result, setResult] = useState<{ done?: number; left?: number; error?: true } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-white p-5">
      <p className="min-w-0 flex-1 text-sm text-slate">{t("placeTypesHint")}</p>
      <button
        type="button"
        disabled={pending} aria-busy={pending}
        onClick={() => startTransition(async () => setResult(await backfillPlaceTypes()))}
        className="rounded-xl bg-ink px-4 py-2 text-sm font-black text-paper disabled:opacity-40"
      >
        {t("placeTypesButton")}
      </button>
      {result && (
        <span role="status" className="text-sm font-black">
          {result.error ? t("refreshPagesError") : t("placeTypesDone", { done: result.done ?? 0, left: result.left ?? 0 })}
        </span>
      )}
    </div>
  );
}

/** Bulk fix: tick workplaces of one category and move them to another. */
export function BulkCategory({ rows }: { rows: { id: string; name: string; address: string; city: string; kind: string }[] }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!rows.length) return <p className="rounded-3xl bg-white p-5 text-slate">{t("empty")}</p>;
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-white p-5">
      <label className="flex items-center gap-2 text-sm font-black">
        <input
          type="checkbox"
          checked={selected.length === rows.length}
          onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
        />
        {t("bulkAll", { count: rows.length })}
      </label>
      <ul className="flex flex-col divide-y divide-[#E8E6E1]">
        {rows.map((r) => (
          <li key={r.id}>
            <label className="flex items-start gap-3 py-2">
              <input type="checkbox" className="mt-1" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
              <span>
                <span className="block font-black">{r.name}</span>
                <span className="text-sm text-slate">
                  {r.kind} · {r.address}, {r.city}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 border-t border-[#E8E6E1] pt-3 sm:flex-row sm:items-center">
        <CategorySelect
          auto={false}
          value={target}
          onChange={setTarget}
          className="min-w-0 flex-1 rounded-xl border border-mist/60 bg-white px-3 py-2"
        />
        <button
          type="button"
          disabled={pending || !selected.length || !target}
          aria-busy={pending}
          onClick={() =>
            startTransition(async () => {
              setError(false);
              const result = await bulkSetCategory(selected, target);
              if (result.error) return setError(true);
              setSelected([]);
              router.refresh();
            })
          }
          className="rounded-xl bg-ink px-4 py-2 text-sm font-black text-paper disabled:opacity-40"
        >
          {t("bulkMove", { count: selected.length })}
        </button>
      </div>
      {error && <p className="text-sm font-black">{t("error")}</p>}
    </div>
  );
}
