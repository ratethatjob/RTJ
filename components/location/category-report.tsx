"use client";

import { useState, useTransition } from "react";
import { reportCategory } from "@/app/[locale]/category-actions";

type Labels = { open: string; title: string; choose: string; note: string; send: string; done: string; error: string };

/** "Wrong category? Tell us": anyone can suggest the right one; it goes to the admin's check list.
 *  Texts and options come from the server page, so public pages ship no extra messages. */
export function CategoryReport({
  locationId,
  options,
  labels,
}: {
  locationId: string;
  options: { value: string; label: string }[];
  labels: Labels;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const [pending, startTransition] = useTransition();

  if (state === "done") return <p role="status" className="text-sm font-black">{labels.done}</p>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-slate underline underline-offset-4">
        {labels.open}
      </button>
    );
  }
  return (
    <form
      className="flex w-full max-w-md flex-col gap-2 rounded-2xl bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await reportCategory(locationId, category, note);
          setState(result.ok ? "done" : "error");
        });
      }}
    >
      <p className="font-black">{labels.title}</p>
      <select
        required
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        aria-label={labels.title}
        className="rounded-xl border border-mist/60 bg-white px-3 py-2"
      >
        <option value="" disabled>
          {labels.choose}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder={labels.note}
        aria-label={labels.note}
        className="rounded-xl border border-mist/60 bg-white px-3 py-2"
      />
      <button
        type="submit"
        disabled={pending || !category}
        aria-busy={pending}
        className="self-start rounded-xl bg-ink px-4 py-2 text-sm font-black text-paper disabled:opacity-50"
      >
        {labels.send}
      </button>
      {state === "error" && <p className="text-sm font-black">{labels.error}</p>}
    </form>
  );
}
