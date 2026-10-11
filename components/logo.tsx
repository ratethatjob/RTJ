export function BrandIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 95" aria-hidden="true" className={className}>
      <path
        d="M10 0h80a10 10 0 0 1 10 10v55a10 10 0 0 1-10 10H50L25 95V75H10A10 10 0 0 1 0 65V10A10 10 0 0 1 10 0Z"
        fill="#3DDC97"
      />
      <path
        d="M28 39l14 14 30-30"
        fill="none"
        stroke="#14161A"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 sm:gap-2.5">
      <BrandIcon className="h-6 w-auto shrink-0" />
      <span
        className={`text-[17px] leading-none tracking-brand sm:text-xl ${compact ? "hidden sm:inline" : ""}`}
      >
        <span className={`font-black ${dark ? "text-paper" : "text-ink"}`}>
          RateThatJob
        </span>
        <span className={dark ? "text-mist" : "text-slate"}>.com</span>
      </span>
    </span>
  );
}
