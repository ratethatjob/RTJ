"use client";

import { useState } from "react";
import { GlobeIcon } from "./icons";

type Props = {
  original: string;
  /** Machine translation into the reader's language, or null when we show the original. */
  translated: string | null;
  /** "Original: Hungarian" (null when the language is unknown). */
  originalLabel: string | null;
  translatedLabel: string;
  showOriginalLabel: string;
  showTranslationLabel: string;
  className?: string;
};

/**
 * User-written text everywhere (reviews, employer replies, messages): a small tag with the original
 * language, and "Translated · Show original" when a translation is shown.
 */
export function TranslatedText({
  original,
  translated,
  originalLabel,
  translatedLabel,
  showOriginalLabel,
  showTranslationLabel,
  className = "text-lg leading-relaxed",
}: Props) {
  const [showOriginal, setShowOriginal] = useState(false);
  const showingTranslation = translated != null && !showOriginal;

  return (
    <>
      <p className={`whitespace-pre-line ${className}`}>{showingTranslation ? translated : original}</p>
      {(translated != null || originalLabel) && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate">
          <GlobeIcon className="size-4 shrink-0" />
          <span>{showingTranslation ? translatedLabel : originalLabel}</span>
          {translated != null && (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => setShowOriginal((v) => !v)}
                className="font-black text-ink underline underline-offset-4"
              >
                {showingTranslation ? showOriginalLabel : showTranslationLabel}
              </button>
            </>
          )}
        </p>
      )}
    </>
  );
}
