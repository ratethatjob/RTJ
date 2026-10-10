// Small flags for the language menu (emoji flags don't render on Windows).
export function Flag({ locale, className }: { locale: string; className?: string }) {
  if (locale === "hu") {
    return (
      <svg viewBox="0 0 6 4" className={className} aria-hidden="true">
        <rect width="6" height="4" fill="#477050" />
        <rect width="6" height="2.667" fill="#FFFFFF" />
        <rect width="6" height="1.333" fill="#CE2939" />
      </svg>
    );
  }
  // English: United Kingdom
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden="true">
      <clipPath id="uk-t">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#uk-t)" stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}
