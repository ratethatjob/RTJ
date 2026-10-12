// Simple flat illustrations for the sample workplace (a made-up bakery): its logo and three
// "employer photos". Drawn here so nothing points to a real business.

const CRUST = "#C9853F";
const DOUGH = "#F3D9A4";
const WALL = "#EDE3D3";
const INK = "#14161A";

/** Round logo: a croissant over "K&K". */
export function ShowcaseLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Kávé & Kovász">
      <circle cx="60" cy="60" r="58" fill={INK} />
      <circle cx="60" cy="60" r="50" fill="none" stroke={DOUGH} strokeWidth="2" strokeDasharray="3 5" />
      <path d="M30 58c6-16 22-24 30-24s24 8 30 24c-8-4-14-4-18-2-3-6-8-9-12-9s-9 3-12 9c-4-2-10-2-18 2z" fill={CRUST} />
      <path d="M44 52c4-6 10-9 16-9s12 3 16 9" fill="none" stroke={DOUGH} strokeWidth="2.5" strokeLinecap="round" />
      <text x="60" y="88" textAnchor="middle" fontFamily="Archivo, Arial, sans-serif" fontWeight="900" fontSize="20" fill={DOUGH}>
        K&amp;K
      </text>
    </svg>
  );
}

/** Shop front with an awning. */
export function ShowcaseStorefront({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" className={className} role="img" aria-hidden="true">
      <rect width="400" height="300" fill="#F7EFE2" />
      <rect x="40" y="70" width="320" height="230" fill={WALL} />
      <path d="M30 70h340l-14 44H44z" fill={INK} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <path key={i} d={`M${44 + i * 39} 114h39l-6 22h-27z`} fill={i % 2 ? DOUGH : CRUST} />
      ))}
      <rect x="60" y="150" width="170" height="120" rx="6" fill="#FFFFFF" stroke={INK} strokeWidth="4" />
      <path d="M85 230c6-14 16-20 28-20s22 6 28 20z" fill={CRUST} />
      <ellipse cx="180" cy="232" rx="28" ry="12" fill={DOUGH} stroke={CRUST} strokeWidth="3" />
      <rect x="252" y="150" width="88" height="150" rx="6" fill={INK} />
      <circle cx="326" cy="228" r="5" fill={DOUGH} />
      <text x="200" y="98" textAnchor="middle" fontFamily="Archivo, Arial, sans-serif" fontWeight="900" fontSize="22" fill={DOUGH}>
        KÁVÉ &amp; KOVÁSZ
      </text>
    </svg>
  );
}

/** Bread on the counter shelves. */
export function ShowcaseCounter({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" className={className} role="img" aria-hidden="true">
      <rect width="400" height="300" fill={WALL} />
      {[70, 150].map((y) => (
        <g key={y}>
          <rect x="30" y={y + 50} width="340" height="10" fill={INK} />
          {[0, 1, 2, 3, 4].map((i) => (
            <ellipse key={i} cx={70 + i * 65} cy={y + 34} rx="28" ry="17" fill={i % 2 ? CRUST : "#B06F2F"} />
          ))}
        </g>
      ))}
      <rect x="0" y="230" width="400" height="70" fill={INK} />
      <rect x="20" y="246" width="360" height="8" rx="4" fill={DOUGH} />
    </svg>
  );
}

/** A cup of coffee with a croissant. */
export function ShowcaseCoffee({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" className={className} role="img" aria-hidden="true">
      <rect width="400" height="300" fill="#3A2A20" />
      <ellipse cx="160" cy="200" rx="110" ry="30" fill="#FFFFFF" opacity="0.9" />
      <path d="M100 120h120l-14 80h-92z" fill="#FFFFFF" />
      <path d="M220 140c30 0 30 40 0 40" fill="none" stroke="#FFFFFF" strokeWidth="10" />
      <ellipse cx="160" cy="122" rx="58" ry="10" fill="#7A4A2A" />
      <path d="M140 110c-6-12 6-20 0-34M170 110c-6-12 6-20 0-34" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
      <path d="M262 200c8-24 26-36 44-36s36 12 44 36c-10-6-20-6-26-3-5-9-12-13-18-13s-13 4-18 13c-6-3-16-3-26 3z" fill={CRUST} />
    </svg>
  );
}
