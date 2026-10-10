/** "Quick apply" marker: no CV, a few yes/no questions. */
export function QuickBadge({ label, large = false }: { label: string; large?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg bg-ink font-black text-signal ${
        large ? "px-3 py-1.5" : "px-2.5 py-1 text-sm"
      }`}
    >
      <svg viewBox="0 0 24 24" className={large ? "size-4" : "size-3.5"} fill="currentColor" aria-hidden="true">
        <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
      </svg>
      {label}
    </span>
  );
}
