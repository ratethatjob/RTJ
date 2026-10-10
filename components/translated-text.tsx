"use client";

import { useState } from "react";
import { GlobeIcon } from "./icons";

type Props = {
  translated: string;
  original: string;
  note: string;
  showOriginalLabel: string;
  showTranslationLabel: string;
};

/** Shows a machine translation with a toggle back to the original text. */
export function TranslatedText({
  translated,
  original,
  note,
  showOriginalLabel,
  showTranslationLabel,
}: Props) {
  const [showOriginal, setShowOriginal] = useState(false);

  return (
    <>
      <p className="text-lg leading-relaxed">{showOriginal ? original : translated}</p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#E8E6E1] pt-4 text-slate">
        <span className="flex items-center gap-2">
          <GlobeIcon className="size-4 shrink-0" />
          {note}
        </span>
        <button
          type="button"
          onClick={() => setShowOriginal((v) => !v)}
          className="shrink-0 font-black text-ink underline underline-offset-4"
        >
          {showOriginal ? showTranslationLabel : showOriginalLabel}
        </button>
      </div>
    </>
  );
}
